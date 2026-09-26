"""Soundtrack for the promo video, synthesised from the scene's own timeline.

Nothing here is sampled or licensed: the lo-fi track, key clicks, ringtone and
UI sounds are all generated, so the video can be published anywhere without a
music licence. build_promo_video.py passes in the cue sheet returned by
audioCues() in promo-video.html, which keeps every sound on its frame.

The music is the tutorial video's own audio. It is rendered once against
*video* time and read back through the scene's playback clock, so a shortcut
pause silences it, a jump back replays the same bars, and a skip jumps ahead.
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
BPM = 80
BEAT = 60 / BPM
BAR = 4 * BEAT
RNG = np.random.default_rng(2026)  # fixed seed: every render sounds the same

# ii-V-I-vi in C, voiced like a Rhodes player would: (bass, chord tones).
CHORDS = [
    (50, [53, 57, 60, 64]),   # Dm9
    (43, [53, 59, 64, 69]),   # G13
    (48, [52, 55, 59, 62]),   # Cmaj9
    (45, [55, 60, 64, 71]),   # Am9
]
# Sparse melody per bar of the 4-bar loop: (16th step, midi note).
MELODY = {1: [(6, 76), (8, 74), (10, 71)], 3: [(4, 72), (6, 71), (8, 67), (12, 64)]}
MELODY_B = {0: [(10, 69), (12, 72), (14, 74)]}   # every other loop


# ---------------------------------------------------------------- basics

def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tarr(seconds):
    return np.arange(int(seconds * SR)) / SR


def noise(n):
    return RNG.standard_normal(n)


def filt(x, kind, freq, order=2):
    return signal.sosfilt(signal.butter(order, freq, btype=kind, fs=SR, output='sos'), x, axis=-1)


def norm(x, peak=1.0):
    m = np.max(np.abs(x))
    return x * (peak / m) if m else x


def pan2(x, pan):
    """Mono to stereo with a constant-power pan (-1 left .. +1 right)."""
    a = (pan + 1) * np.pi / 4
    return np.vstack([x * np.cos(a), x * np.sin(a)]) * np.sqrt(2)


def add(buf, x, t, pan=0.0, gain=1.0):
    """Mix x (mono or stereo) into the stereo buffer at time t seconds."""
    if x.ndim == 1:
        x = pan2(x, pan)
    i = int(round(t * SR))
    if i < 0:
        x, i = x[:, -i:], 0
    n = min(x.shape[1], buf.shape[1] - i)
    if n > 0:
        buf[:, i:i + n] += x[:, :n] * gain


def reverb(x, rt=1.2, wet=.25, seed=1):
    """Cheap stereo room: convolution with decaying, darkened noise."""
    r = np.random.default_rng(seed)
    t = tarr(rt)
    ir = r.standard_normal((2, len(t))) * np.exp(-6.9 * t / rt)
    ir = filt(ir, 'lowpass', 5000)
    ir[:, :int(.012 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    wetsig = np.vstack([signal.fftconvolve(x[c], ir[c])[:x.shape[1]] for c in range(2)])
    return x + wet * wetsig


def sweep_filter(x, f0, f1, q=.9):
    """Band-pass with an exponential centre sweep (Chamberlin state variable)."""
    n = len(x)
    fc = f0 * (f1 / f0) ** (np.arange(n) / n)
    k = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    low = band = 0.0
    out = np.empty(n)
    for i in range(n):
        low += k[i] * band
        high = x[i] - low - q * band
        band += k[i] * high
        out[i] = band
    return out


# ---------------------------------------------------------------- instruments

def ep_note(f, dur, vel, detune=1.0):
    """Electric piano: soft fundamental, fading harmonics, a short bell 'tine'."""
    t = tarr(dur + 1.4)
    ff = f * detune
    x = (np.sin(2 * np.pi * ff * t)
         + .22 * np.exp(-t / .6) * np.sin(2 * np.pi * 2 * ff * t)
         + .07 * np.exp(-t / .25) * np.sin(2 * np.pi * 3 * ff * t)
         + .09 * np.exp(-t / .025) * np.sin(2 * np.pi * min(ff * 7, 9000) * t))
    env = np.minimum(1, t / .005) * np.exp(-t / 1.9) * np.where(t < dur, 1, np.exp(-(t - dur) / .18))
    return x * env * vel


def chord(buf, t0, notes, dur, vel):
    for j, m in enumerate(notes):
        v = vel * (.9 + .2 * RNG.random())
        at = t0 + j * .014                      # a slight strum
        add(buf, ep_note(midi(m), dur, v), at, pan=-.35)
        add(buf, ep_note(midi(m), dur, v, 1.0028), at + .006, pan=.35)


def bass_note(f, dur, vel):
    t = tarr(dur + .3)
    x = np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2 * f * t) + .08 * np.sin(2 * np.pi * 3 * f * t)
    env = np.minimum(1, t / .008) * np.exp(-t / 1.1) * np.where(t < dur, 1, np.exp(-(t - dur) / .06))
    return np.tanh(1.6 * x * env) / np.tanh(1.6) * vel


def kick(vel):
    t = tarr(.45)
    f = 46 + 95 * np.exp(-t / .03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .22)
    x += .3 * filt(noise(len(t)), 'lowpass', 2500) * np.exp(-t / .004)
    return np.tanh(1.3 * x) * vel


def snare(vel):
    t = tarr(.35)
    x = .55 * filt(noise(len(t)), 'bandpass', [900, 5500]) * np.exp(-t / .11)
    x += .45 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / .045)
    return x * vel


def hat(vel):
    t = tarr(.08)
    return filt(noise(len(t)), 'highpass', 7000) * np.exp(-t / .018) * vel


def render_music(seconds):
    """The tutorial's background track, indexed by video time."""
    n = int(seconds * SR)
    keys_bus = np.zeros((2, n))
    bass_bus = np.zeros((2, n))
    drums = np.zeros((2, n))
    kicks = []
    step = BEAT / 4
    for b in range(int(seconds / BAR) + 1):
        t0 = b * BAR
        root, voicing = CHORDS[b % 4]
        chord(keys_bus, t0, voicing, 1.4 * BEAT, .9)
        chord(keys_bus, t0 + 1.5 * BEAT, voicing, 2.3 * BEAT, .6)
        add(bass_bus, bass_note(midi(root), 1.6 * BEAT, .9), t0)
        add(bass_bus, bass_note(midi(root), 1.2 * BEAT, .7), t0 + 2.5 * BEAT)
        add(bass_bus, bass_note(midi(root + 7), .45 * BEAT, .45), t0 + 3.5 * BEAT)
        for s, v in ((0, 1), (7, .7), (10, .85)):
            kicks.append(t0 + s * step)
            add(drums, kick(v), t0 + s * step)
        for s in (4, 12):
            add(drums, snare(.8), t0 + s * step + .012)
        for s in range(0, 16, 2):
            swing = .08 * BEAT if (s // 2) % 2 else 0
            add(drums, hat(.35 + .25 * RNG.random() + (.15 if s % 4 == 0 else 0)), t0 + s * step + swing, pan=.25)
        mel = (MELODY_B if (b // 4) % 2 else {}) | MELODY
        for s, m in mel.get(b % 4, []):
            add(keys_bus, ep_note(midi(m), .9 * BEAT, .42), t0 + s * step, pan=.1)

    # Duck the keys and bass a little under each kick: the lo-fi "pump".
    pump = np.ones(n)
    seg = 1 - .28 * np.exp(-np.arange(int(.35 * SR)) / SR / .11)
    for kt in kicks:
        i = int(kt * SR)
        m = min(len(seg), n - i)
        if m > 0:
            pump[i:i + m] = np.minimum(pump[i:i + m], seg[:m])
    trem = 1 + .08 * np.sin(2 * np.pi * 4.3 * np.arange(n) / SR)
    keys_bus = reverb(keys_bus * pump * trem, rt=1.4, wet=.3, seed=3)

    # Vinyl: sparse crackle and a little hiss.
    crackle = np.zeros(n)
    idx = RNG.integers(0, n, size=int(seconds * 14))
    crackle[idx] = RNG.choice([-1, 1], len(idx)) * RNG.uniform(.05, .4, len(idx))
    crackle = filt(crackle, 'bandpass', [900, 6000]) + .004 * filt(noise(n), 'lowpass', 6000)

    mix = .23 * keys_bus + .42 * bass_bus * pump + .55 * drums + pan2(crackle, 0) * .35
    mix = filt(filt(mix, 'lowpass', 5200), 'highpass', 35)
    return norm(np.tanh(1.2 * mix), .8)


# ---------------------------------------------------------------- sound effects

def thock(key):
    """A mechanical key going down: body thump, plastic clack, top click."""
    base = {'Ctrl': 160, 'Shift': 140}.get(key, 185) * (1 + .03 * RNG.standard_normal())
    t = tarr(.12)
    x = (.8 * np.sin(2 * np.pi * base * t * (1 - .25 * t / .12)) * np.exp(-t / .03)
         + .9 * filt(noise(len(t)), 'bandpass', [900, 2600]) * np.exp(-t / .012)
         + .7 * filt(noise(len(t)), 'bandpass', [2500, 9000]) * np.exp(-t / .003))
    return norm(x)


def key_up():
    t = tarr(.05)
    x = (.6 * filt(noise(len(t)), 'bandpass', [2000, 8000]) * np.exp(-t / .0025)
         + .4 * filt(noise(len(t)), 'bandpass', [1200, 3000]) * np.exp(-t / .006))
    return norm(x, .5)


def tap():
    """Laptop key in the editor: lighter and brighter than the shortcut keys."""
    t = tarr(.04)
    x = (filt(noise(len(t)), 'bandpass', [2500, 9000]) * np.exp(-t / .002)
         + .35 * np.sin(2 * np.pi * (300 + 120 * RNG.random()) * t) * np.exp(-t / .008))
    return norm(x)


def whoosh(dur, f0, f1):
    t = tarr(dur)
    return norm(sweep_filter(noise(len(t)), f0, f1) * np.sin(np.pi * t / dur) ** 1.5)


def pop(f0, f1, dur=.09):
    t = tarr(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .03) * np.minimum(1, t / .002)


def bell(f, dur=1.4, bright=1.0):
    t = tarr(dur)
    x = (np.sin(2 * np.pi * f * t)
         + .45 * np.exp(-t / .5) * np.sin(2 * np.pi * 2.76 * f * t)
         + .2 * bright * np.exp(-t / .18) * np.sin(2 * np.pi * 5.4 * f * t))
    return norm(x * np.minimum(1, t / .003) * np.exp(-t / .55))


def marimba(f, dur=.5):
    t = tarr(dur)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / .28)
         + .35 * np.sin(2 * np.pi * 3.98 * f * t) * np.exp(-t / .03)
         + .1 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t / .01))
    return norm(x * np.minimum(1, t / .002))


def blip(f, dur=.07):
    t = tarr(dur)
    return np.sin(2 * np.pi * f * t) * np.minimum(1, t / .004) * np.minimum(1, (dur - t) / .02)


def mouse_click():
    t = tarr(.1)
    one = (filt(noise(len(t)), 'bandpass', [2000, 7000]) * np.exp(-t / .0015)
           + .4 * np.sin(2 * np.pi * 1700 * t) * np.exp(-t / .005))
    x = one.copy()
    lag = int(.07 * SR)
    x[lag:] += .5 * one[:len(x) - lag]
    return norm(x)


def tick():
    t = tarr(.03)
    x = filt(noise(len(t)), 'bandpass', [3000, 8000]) * np.exp(-t / .0015) + .5 * np.sin(2 * np.pi * 2200 * t) * np.exp(-t / .004)
    return norm(x)


def thud():
    t = tarr(.25)
    f = 70 + 60 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .09)


# ---------------------------------------------------------------- the score

def play_music(cues, t, music):
    """Read the music through the scene's playback clock."""
    V = cues['video']
    intervals, start = [], (0.0 if V['startPlaying'] else None)
    for e in V['events']:
        if 'play' in e:
            if e['play'] and start is None:
                start = e['t']
            elif not e['play'] and start is not None:
                intervals.append((start, e['t']))
                start = None
    if start is not None:
        intervals.append((start, np.inf))

    v = np.full_like(t, V['start'])
    gain = np.zeros_like(t)
    for a, b in intervals:
        v += np.clip(t - a, 0, b - a)
        up = np.clip((t - a) / .05, 0, 1) if a > 0 else np.clip(t / .03, 0, 1)
        down = np.clip((b - t) / .03, 0, 1)            # a pause cuts the sound, like the real thing
        gain = np.maximum(gain, up * down * (t >= a) * (t < b))
    for e in V['events']:
        if 'seek' in e:
            ts = e['t'] + .03
            v += e['seek'] * (t >= ts)
            gain *= np.clip(np.abs(t - ts) / .02, 0, 1)  # dip across the jump so it doesn't click

    idx = np.clip(np.round(v * SR).astype(int), 0, music.shape[1] - 1)
    return music[:, idx] * gain


def render(cues, path):
    dur = cues['duration']
    n = int(dur * SR)
    t = np.arange(n) / SR
    music = render_music(float(max(cues['video']['start'] + dur + 20, 60)))

    # The tutorial sits back once the focus moves to the settings, then bows out.
    bed = play_music(cues, t, music)
    duck = 1 - .5 * np.clip((t - cues['dim']) / .5, 0, 1)
    duck *= 1 - np.clip((t - cues['endcard']) / .8, 0, 1)
    bed *= duck

    keys = np.zeros((2, n + SR))
    ui = np.zeros((2, n + SR))
    ring = np.zeros((2, n + SR))

    for k in cues['keyDowns']:
        add(keys, thock(k['key']), k['t'], pan=k['pan'], gain=.9 + .1 * RNG.random())
    for k in cues['keyUps']:
        add(keys, key_up(), k['t'], pan=k['pan'], gain=.8)
    for tt in cues['typing']:
        add(keys, tap(), tt + .008 * RNG.standard_normal(), pan=.45, gain=.22 + .06 * RNG.random())
    for tt in cues['dots']:
        add(ui, whoosh(.22, 700, 2600), tt, gain=.12)

    C = cues['call']
    for r in np.arange(0, C['ringUntil'], 1.0):
        for dt, m in ((0, 76), (.12, 80), (.24, 83), (.36, 80)):
            add(ring, marimba(midi(m)), r + dt, pan=.55)
    add(ui, blip(midi(84)), C['answered'], pan=.55, gain=.35)
    add(ui, blip(midi(91)), C['answered'] + .08, pan=.55, gain=.35)
    # The call time-lapses to 12 minutes: a clock ticking faster and faster.
    a, b = C['lapse']
    tt, gap = a, .13
    while tt < b:
        add(ui, tick(), tt, pan=.55, gain=.22)
        tt += gap
        gap = max(.028, gap * .82)
    add(ui, blip(midi(79)), C['ended'], pan=.55, gain=.3)
    add(ui, blip(midi(72)), C['ended'] + .09, pan=.55, gain=.3)
    add(ui, whoosh(.4, 1600, 500), C['leave'], pan=.7, gain=.25)

    for tt in cues['pin']:
        add(ui, pop(900, 520, .07), tt, pan=-.6, gain=.5)
    for tt in cues['callouts']:
        add(ui, pop(1300, 1800, .04), tt, gain=.18)
    for tt in cues['pip']:
        add(ui, whoosh(.45, 400, 2200), tt - .05, pan=.3, gain=.35)
        add(ui, pop(260, 620, .1), tt + .3, pan=.5, gain=.4)
    for tt in cues['minimize']:
        add(ui, whoosh(.6, 2600, 300), tt, pan=-.4, gain=.4)
        add(ui, thud(), tt + .6, pan=-.8, gain=.5)

    add(ui, whoosh(.5, 300, 1200), cues['dim'], gain=.25)
    add(ui, whoosh(.4, 500, 1800), cues['card'], pan=.4, gain=.25)
    for tt in cues['clicks']:
        add(ui, mouse_click(), tt, pan=.45, gain=.55)
    P, G = cues['popup'], cues['page']
    add(ui, pop(500, 900, .08), P['open'], pan=.6, gain=.35)
    for i, m in enumerate((84, 86, 88, 91, 93, 96, 98)[:cues['rows']]):
        add(ui, bell(midi(m), .5, .5), P['rows'] + i * .15, pan=.5, gain=.1)
    add(ui, pop(900, 500, .06), P['close'], pan=.6, gain=.25)
    add(ui, whoosh(.3, 800, 2000), G['newTab'], pan=.4, gain=.15)
    add(ui, pop(1500, 1700, .03), G['focus'], pan=.4, gain=.2)
    add(ui, bell(midi(88), .6), G['fill'], pan=.4, gain=.14)
    add(ui, bell(midi(88), 1.0), G['global'], pan=.5, gain=.2)
    add(ui, bell(midi(95), 1.0), G['global'] + .05, pan=.5, gain=.16)

    # End card: a swell into the card, a resolving chord under the call to action.
    e = cues['endcard']
    add(ui, whoosh(.6, 250, 1400), e - .3, gain=.3)
    outro = np.zeros((2, n + SR))
    chord(outro, e + .95, [48, 52, 55, 59, 62], 3.0, .8)
    for i, m in enumerate((84, 88, 91, 95)):
        add(outro, bell(midi(m), 1.6) * .35, e + 1.0 + i * .06, pan=-.3 + .2 * i)
    shimmer = filt(noise(int(.6 * SR)), 'highpass', 6000) * np.sin(np.pi * np.arange(int(.6 * SR)) / int(.6 * SR)) ** 2
    add(ui, shimmer, e + 2.1, gain=.05)

    # Faint room tone under everything, so a pause sounds like a quiet room
    # rather than a dropout.
    room = pan2(filt(np.cumsum(noise(n + SR)) * .002, 'bandpass', [60, 700]), 0)
    room = norm(room, .006) * np.clip((cues['endcard'] + 1.2 - np.arange(n + SR) / SR) / 1.2, 0, 1)

    ui = reverb(ui, rt=1.0, wet=.3, seed=5)
    ring = reverb(ring, rt=1.0, wet=.25, seed=6)
    outro = reverb(outro, rt=2.2, wet=.45, seed=7)

    mix = (.5 * bed
           + .42 * keys[:, :n]
           + ui[:, :n]
           + .3 * ring[:, :n]
           + .08 * outro[:, :n]
           + room[:, :n])
    tail = np.clip((dur - t) / .4, 0, 1)            # land softly on the last frame
    mix = norm(np.tanh(mix * tail), .89)
    wavfile.write(path, SR, mix.T.astype(np.float32))
