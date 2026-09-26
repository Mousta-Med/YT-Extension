# YouTube Global Controls Chrome Extension

A lightweight Chrome extension that provides global keyboard shortcuts to control YouTube video playback from anywhere, even when you're not on the YouTube tab.

## Features

🎮 **Global Video Controls**
- Play/Pause videos from anywhere
- Picture-in-Picture mode control
- Skip forward/backward 10 seconds
- Next / previous video, in playlists, "Up next" and Shorts
- Mute, volume and playback speed
- Works even when Chrome is minimized or you're on other tabs

⌨️ **Keyboard Shortcuts**
- `Ctrl+Shift+1` (or `Cmd+Shift+1` on Mac) - Toggle Play/Pause
- `Ctrl+Shift+2` (or `Cmd+Shift+2` on Mac) - Toggle Picture-in-Picture
- `Ctrl+Shift+9` (or `Cmd+Shift+9` on Mac) - Skip backward 10 seconds
- `Ctrl+Shift+0` (or `Cmd+Shift+0` on Mac) - Skip forward 10 seconds

> **Why digits?** Chrome only accepts `Ctrl+Shift+[0-9]` as a *suggested* shortcut
> for global commands — any other combination is silently dropped and the command
> installs unbound. That restriction applies only to the defaults shipped in the
> manifest: you can rebind these to any combination you like at
> `chrome://extensions/shortcuts` and still keep them set to **Global**.

➕ **More Controls** (no default key — assign your own)
- Next video
- Previous video
- Mute / unmute
- Volume up / down (10% steps)
- Speed up / slow down (YouTube's own speed steps, 0.25× to 2×)

> Chrome lets an extension ship default keys for at most **four** commands, so
> these start as **Not set**. Give the ones you want a key at
> `chrome://extensions/shortcuts` and set their scope to **Global** — Chrome
> puts every key you add yourself in the **In Chrome** scope, which only works
> while Chrome is focused.

🎛️ **Shortcut Overview Popup**
- Click the toolbar icon to see every shortcut and its current binding
- Unassigned default shortcuts are called out, so you notice before wondering why nothing happens
- The extra controls are listed separately, so unset ones don't look like a fault
- One click opens Chrome's shortcut editor

> Chrome does not let an extension set its own shortcuts (`chrome.commands.update`
> is Firefox-only), so the actual rebinding happens on `chrome://extensions/shortcuts`.
> The popup shows the live state and takes you there in one click.

🔔 **Smart Notifications**
- Helpful notifications when YouTube isn't ready
- Click notifications to automatically navigate to YouTube

🚀 **Works on Unvisited Tabs**
- Automatically injects scripts into restored/unvisited YouTube tabs
- No need to manually visit the YouTube tab first

📌 **Smart Tab Pinning**
- **Playing video** → Automatically pins the YouTube tab
- **Paused video** → Automatically unpins the YouTube tab
- **PIP mode** → No pinning/unpinning behavior (works independently)
- Keeps YouTube easily accessible when actively watching, declutters when paused

## Installation

### From the Chrome Web Store (recommended)

**[Install YouTube Global Controls](https://chromewebstore.google.com/detail/kdagmajfmfaaamooaohkdhimdojbejdo)**

Updates arrive automatically, and because the extension keeps a stable ID, your
shortcut assignments sync to every machine signed into the same Chrome profile.

### From a GitHub release

Grab the latest `.zip` from the [Releases page](../../releases).

> Chrome cannot install a `.zip` directly — it has to be unpacked first.

1. Download `yt-global-controls-X.Y.Z.zip`
2. Unzip it into a folder you intend to keep — **deleting the folder uninstalls
   the extension**, since Chrome loads it from that path
3. Open `chrome://extensions/`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the unzipped folder
6. Confirm "YouTube Global Controls" appears and is enabled

Chrome shows a "Disable developer mode extensions" warning on startup for
unpacked extensions. That is expected; the Web Store build avoids it.

### From source

Clone the repository and load the folder itself with **Load unpacked**, as in
steps 3-6 above.

## Releasing

Releases are built by [`.github/workflows/release.yml`](.github/workflows/release.yml).
Bump `version` in `manifest.json`, then push a matching tag:

```bash
git tag v1.0.3
git push origin v1.0.3
```

The workflow verifies the tag matches the manifest version, packages only the
files Chrome needs, and publishes a release with the `.zip` and install
instructions attached. A mismatched tag fails the build rather than shipping a
mislabelled package.

## Usage

### Basic Usage

1. **Open YouTube**
   - Open any YouTube video in a tab
   - You don't need to actively visit the tab

2. **Use Global Controls**
   - Switch to any other tab, window, or application
   - Use keyboard shortcuts to control YouTube
   - Works even if the YouTube tab was never visited (e.g., restored tabs)

3. **Smart Tab Management**
   - Use `Ctrl+Shift+1` to play/pause - tab automatically pins when playing, unpins when paused
   - Use `Ctrl+Shift+2` for Picture-in-Picture without affecting tab pin status
   - Skip controls and the extra controls work normally without affecting pinning

### Next and Previous

- **In a playlist or mix** they step through the playlist
- **Outside a playlist**, Next plays YouTube's "Up next" video, and Previous
  goes back to the video the tab played before — only when that really was a
  video, so it never backs out to the homepage or off YouTube. On a video you
  opened directly, Previous does nothing
- **On Shorts** they move to the next or previous short

Mute, volume and speed go through YouTube's own player, so its controls and
settings menu stay in step and your choice carries over to the next video.

### How It Works

The extension automatically:
- Detects YouTube tabs in your browser
- Injects control scripts when needed
- Handles both active and unvisited/restored tabs
- Provides feedback through notifications
- Manages tab pinning based on video playback state

### Supported YouTube Pages

- Regular YouTube videos (`youtube.com/watch`)
- YouTube Shorts (`youtube.com/shorts`)
- Any YouTube page with video content

### Troubleshooting

**Shortcuts not working?**
- Ensure the extension is enabled in `chrome://extensions/`
- Check for notification messages that guide you
- Make sure no other application is using the same shortcuts

**An extra control (next, previous, mute, volume, speed) does nothing?**
- It has no key until you assign one at `chrome://extensions/shortcuts`
- If it only works while Chrome is focused, switch its scope to **Global**
- Speed up / slow down stop at 2× and 0.25×

**Picture-in-Picture not working?**
- Ensure the video is loaded and playing
- Some videos may not support PiP due to restrictions

**Tab pinning not working?**
- Pinning is driven **only** by the play/pause shortcut. Playing or pausing by clicking the page, autoplay, and ad breaks all leave the pin untouched
- Only applies on `/watch` and `/shorts` pages, so homepage hover previews don't pin the tab
- PIP shortcut intentionally doesn't change pin status
- Manual pinning/unpinning will be overridden the next time you use the play/pause shortcut

## Technical Details

### Architecture

- **Manifest V3** - Latest Chrome extension API
- **Service Worker** (`background.js`) - Handles global shortcuts and tab management
- **Content Script** (`content.js`) - Interacts with YouTube pages
- **Player API Injection** - Next/previous, mute, volume and speed call YouTube's
  own player API, injected into the page with `chrome.scripting` because the
  isolated content script cannot reach it
- **Dynamic Script Injection** - Automatically handles unvisited tabs

### Key Features

- **Smart Tab Detection** - Finds YouTube tabs automatically
- **State-Based Tab Pinning** - Pins/unpins based on video play state
- **Script Auto-Injection** - Injects scripts into unvisited tabs when needed
- **Robust Error Handling** - Graceful fallbacks when commands fail
- **Lightweight** - Minimal resource usage and clean code

### Permissions

- `tabs` - Find and communicate with YouTube tabs
- `scripting` - Inject content scripts dynamically
- `notifications` - Provide user feedback
- `host_permissions` - Access YouTube domains

### Files

- `manifest.json` - Extension configuration
- `background.js` - Service worker with smart tab management
- `content.js` - Content script for YouTube interaction
- `popup.html` / `popup.js` - Toolbar popup listing current shortcut bindings
- `icon{16,48,128}.png` - Extension icons
- `store-assets/` - Chrome Web Store listing images, the promo video, and the scripts that generate them.
  The video is animated in `promo-video.html` and rendered by `build_promo_video.py`
  (needs Chrome, ffmpeg and `pip install websockets numpy scipy`). The soundtrack is
  synthesised by `promo_audio.py` from the same timeline, so there is no music licence to worry about
- `LICENSE` - MIT license

## Customization

### Changing Keyboard Shortcuts

1. Go to `chrome://extensions/shortcuts`
2. Find "YouTube Global Controls"
3. Modify shortcuts as needed

### Available Commands

- Toggle Play/Pause (affects tab pinning)
- Toggle Picture-in-Picture (no pinning effect)
- Skip backward 10 seconds
- Skip forward 10 seconds
- Next video / Previous video (no default key)
- Mute / unmute (no default key)
- Volume up / down 10% (no default key)
- Speed up / slow down playback (no default key)

## Development

### Testing

1. Load extension in developer mode
2. Open YouTube video (don't need to visit tab)
3. Test shortcuts from other tabs/applications
4. Verify notifications work correctly
5. Test tab pinning behavior with play/pause

### Debugging

- Check browser console for debug messages
- Use `chrome://extensions/` to reload after changes
- Monitor notifications for feedback

## Compatibility

- **Chrome Version**: 88+ (Manifest V3 support)
- **Operating Systems**: Windows, macOS, Linux
- **YouTube**: All standard video pages and Shorts

## Privacy

This extension:
- ✅ Only accesses YouTube pages you visit
- ✅ No data collection or tracking
- ✅ Works entirely locally in your browser
- ✅ Open source and transparent

## License

MIT License - See LICENSE file for details.

## Contributing

Feel free to submit issues and enhancement requests!

---

**Note**: This extension is not affiliated with YouTube or Google. It's an independent tool designed to enhance your YouTube viewing experience.
