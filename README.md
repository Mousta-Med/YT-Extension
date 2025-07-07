# YouTube Global Controls Chrome Extension

A lightweight Chrome extension that provides global keyboard shortcuts to control YouTube video playback from anywhere, even when you're not on the YouTube tab.

## Features

🎮 **Global Video Controls**
- Play/Pause videos from anywhere
- Picture-in-Picture mode control
- Skip forward/backward 10 seconds
- Works even when Chrome is minimized or you're on other tabs

⌨️ **Keyboard Shortcuts**
- `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on Mac) - Toggle Play/Pause
- `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) - Toggle Picture-in-Picture
- `Ctrl+Shift+Right` (or `Cmd+Shift+Right` on Mac) - Skip forward 10 seconds
- `Ctrl+Shift+Left` (or `Cmd+Shift+Left` on Mac) - Skip backward 10 seconds

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

### Developer Mode Installation

1. **Download the Extension**
   - Clone or download this repository

2. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files

4. **Verify Installation**
   - Look for "YouTube Global Controls" in your extensions
   - Ensure it's enabled

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
   - Use `Ctrl+Shift+Space` to play/pause - tab automatically pins when playing, unpins when paused
   - Use `Ctrl+Shift+P` for Picture-in-Picture without affecting tab pin status
   - Skip controls work normally without affecting pinning

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

**Picture-in-Picture not working?**
- Ensure the video is loaded and playing
- Some videos may not support PiP due to restrictions

**Tab pinning not working?**
- Only play/pause shortcut affects pinning
- PIP shortcut intentionally doesn't change pin status
- Manual pinning/unpinning will be overridden by extension when using play/pause

## Technical Details

### Architecture

- **Manifest V3** - Latest Chrome extension API
- **Service Worker** (`background.js`) - Handles global shortcuts and tab management
- **Content Script** (`content.js`) - Interacts with YouTube pages
- **Injected Script** (`injected.js`) - Enhanced YouTube player integration
- **Dynamic Script Injection** - Automatically handles unvisited tabs

### Key Features

- **Smart Tab Detection** - Finds YouTube tabs automatically
- **State-Based Tab Pinning** - Pins/unpins based on video play state
- **Script Auto-Injection** - Injects scripts into unvisited tabs when needed
- **Robust Error Handling** - Graceful fallbacks when commands fail
- **Lightweight** - Minimal resource usage and clean code

### Permissions

- `activeTab` - Interact with YouTube tabs
- `tabs` - Find and communicate with YouTube tabs
- `scripting` - Inject content scripts dynamically
- `notifications` - Provide user feedback
- `host_permissions` - Access YouTube domains

### Files

- `manifest.json` - Extension configuration
- `background.js` - Service worker with smart tab management
- `content.js` - Content script for YouTube interaction
- `injected.js` - Enhanced YouTube API integration
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
