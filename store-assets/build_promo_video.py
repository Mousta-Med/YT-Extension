"""Render the promo video from promo-video.html.

The page exposes window.DURATION and window.renderAt(t); its look at any moment
is a pure function of t, so frames are captured one by one in headless Chrome
and piped straight into ffmpeg. Nothing runs on a wall clock, which keeps every
render identical regardless of how fast the machine is.

The page also returns its timeline as audio cues, which promo_audio.py turns
into the soundtrack, so picture and sound always come from the same table.

    python build_promo_video.py                  # full MP4 with sound
    python build_promo_video.py --audio-only     # re-score, keep the frames
    python build_promo_video.py --no-audio       # silent MP4
    python build_promo_video.py --stills 2 9.5   # PNGs of single moments

Needs Chrome, ffmpeg on PATH, and `pip install websockets numpy scipy`.
"""
import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from websockets.sync.client import connect

OUT = Path(__file__).resolve().parent
SCENE = OUT / "promo-video.html"
CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
W, H = 1920, 1080


class Page:
    """Minimal Chrome DevTools Protocol client for one tab."""

    def __init__(self, ws_url):
        self.ws = connect(ws_url, max_size=None)
        self.next_id = 0

    def call(self, method, **params):
        self.next_id += 1
        self.ws.send(json.dumps({"id": self.next_id, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.next_id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg["result"]

    def eval(self, expression):
        result = self.call("Runtime.evaluate", expression=expression,
                           awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in result:
            raise RuntimeError(result["exceptionDetails"])
        return result["result"].get("value")


def launch_chrome(profile):
    proc = subprocess.Popen([
        CHROME, "--headless=new", "--remote-debugging-port=0",
        f"--user-data-dir={profile}", f"--window-size={W},{H}",
        "--hide-scrollbars", "--force-device-scale-factor=1", "--mute-audio",
        "--no-first-run", "--no-default-browser-check", "about:blank",
    ])
    port_file = Path(profile) / "DevToolsActivePort"
    for _ in range(100):
        if port_file.exists() and port_file.read_text().strip():
            break
        time.sleep(0.1)
    else:
        proc.kill()
        sys.exit("Chrome did not start")
    port = port_file.read_text().split()[0]
    targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
    page = next(t for t in targets if t["type"] == "page")
    return proc, Page(page["webSocketDebuggerUrl"])


def open_scene(page, scene):
    page.call("Emulation.setDeviceMetricsOverride", width=W, height=H,
              deviceScaleFactor=1, mobile=False)
    page.call("Page.enable")
    page.call("Page.navigate", url=Path(scene).resolve().as_uri())
    for _ in range(100):
        if page.eval("document.readyState === 'complete' && typeof renderAt === 'function'"):
            break
        time.sleep(0.1)
    else:
        sys.exit(f"{scene} never became ready")
    page.eval("document.fonts.ready.then(() => true)")


def frame_at(page, t):
    # Two animation frames guarantee the DOM changes are laid out and painted.
    page.eval(f"renderAt({t}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    shot = page.call("Page.captureScreenshot", format="png", optimizeForSpeed=True)
    return base64.b64decode(shot["data"])


# YouTube normalises to about -14 LUFS; sitting a little under that keeps
# the key clicks from being squashed on playback.
LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11"


def mux(video, wav, out, duration):
    """Two-pass loudness normalisation, then AAC audio next to the untouched video."""
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", LOUDNORM + ":print_format=json",
                            "-f", "null", "-"], capture_output=True, text=True)
    err = probe.stderr
    m = json.loads(err[err.rindex("{"):err.rindex("}") + 1])
    ln = (f"{LOUDNORM}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    tmp = Path(out).with_suffix(".tmp.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(wav),
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", ln, "-ar", "48000",
                    "-c:a", "aac", "-b:a", "192k", "-t", str(duration), "-movflags", "+faststart",
                    str(tmp)], check=True)
    os.replace(tmp, out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", default=str(SCENE))
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--out", default=str(OUT / "promo-video-1920x1080.mp4"))
    ap.add_argument("--stills", type=float, nargs="*",
                    help="write PNGs of these moments (seconds) instead of a video")
    ap.add_argument("--stills-dir", default=str(OUT / "promo-stills"))
    ap.add_argument("--no-audio", action="store_true", help="write a silent video")
    ap.add_argument("--audio-only", action="store_true",
                    help="re-score an existing --out video without re-rendering its frames")
    ap.add_argument("--wav", help="also keep the soundtrack as a WAV at this path")
    args = ap.parse_args()

    work = Path(tempfile.mkdtemp(prefix="promo-build-"))
    silent = work / "video.mp4"
    profile = tempfile.mkdtemp(prefix="promo-chrome-")
    proc, page = launch_chrome(profile)
    try:
        open_scene(page, args.scene)
        duration = page.eval("DURATION")
        cues = json.loads(page.eval("JSON.stringify(audioCues())"))

        if args.stills is not None:
            out_dir = Path(args.stills_dir)
            out_dir.mkdir(exist_ok=True)
            for t in args.stills:
                path = out_dir / f"t{t:06.2f}.png"
                path.write_bytes(frame_at(page, t))
                print(path)
            return

        if not args.audio_only:
            frames = round(duration * args.fps)
            ffmpeg = subprocess.Popen([
                "ffmpeg", "-y", "-loglevel", "error",
                "-f", "image2pipe", "-framerate", str(args.fps), "-i", "-",
                "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                args.out if args.no_audio else str(silent),
            ], stdin=subprocess.PIPE)
            started = time.time()
            for i in range(frames):
                ffmpeg.stdin.write(frame_at(page, i / args.fps))
                if i % args.fps == 0:
                    print(f"\r{i / args.fps:5.1f}s / {duration:.1f}s", end="", flush=True)
            ffmpeg.stdin.close()
            if ffmpeg.wait():
                sys.exit("ffmpeg failed")
            print(f"\r{frames} frames in {time.time() - started:.0f}s")
    finally:
        # Killing the launched process leaves Chrome's children running and
        # holding the profile open, so ask the browser to quit instead.
        try:
            page.call("Browser.close")
        except Exception:
            pass
        page.ws.close()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
        for _ in range(20):
            shutil.rmtree(profile, ignore_errors=True)
            if not Path(profile).exists():
                break
            time.sleep(0.25)
        else:
            print(f"warning: could not delete {profile}", file=sys.stderr)

    try:
        if not args.no_audio:
            import promo_audio
            wav = work / "soundtrack.wav"
            started = time.time()
            promo_audio.render(cues, str(wav))
            if args.wav:
                shutil.copyfile(wav, args.wav)
            mux(args.out if args.audio_only else silent, wav, args.out, duration)
            print(f"soundtrack in {time.time() - started:.0f}s")
        print(f"-> {args.out}")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
