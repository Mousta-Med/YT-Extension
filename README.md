# YouTube Global Controls Chrome Extension

A robust Chrome extension that provides global keyboard shortcuts to control YouTube video playback, even when Chrome is minimized or you're not on the YouTube tab.

## Features

🎮 **Global Video Controls**
- Play/Pause videos from anywhere
- Launch Picture-in-Picture mode globally
- Skip forward/backward 10 seconds instantly
- Navigate between videos (next/previous)
- Works even when Chrome is minimized or in the background

⌨️ **Keyboard Shortcuts**
- `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on Mac) - Toggle Play/Pause
- `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) - Toggle Picture-in-Picture
- `Ctrl+Shift+Right` (or `Cmd+Shift+Right` on Mac) - Skip forward 10 seconds
- `Ctrl+Shift+Left` (or `Cmd+Shift+Left` on Mac) - Skip backward 10 seconds

🔔 **Smart Notifications**
- Helpful notifications when YouTube isn't ready
- Click notifications to automatically navigate to YouTube
- Clear feedback for video state and control actions

🚀 **No UI Required**
- Pure keyboard shortcut-based operation
- No popup or interface to distract you
- Works seamlessly in the background

## Installation

### Method 1: Developer Mode (Recommended)

1. **Download the Extension**
   - Clone or download this repository to your computer

2. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Or go to Chrome Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" in the top right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

5. **Verify Installation**
   - Look for "YouTube Global Controls" in your extensions
   - Make sure it's enabled (toggle switch should be on)

### Method 2: Chrome Web Store (Future)
*This extension will be available on the Chrome Web Store once published.*

## Usage

### Basic Usage

1. **Open YouTube**
   - Navigate to any YouTube video
   - Start playing a video

2. **Use Global Controls**
   - Switch to any other tab, window, or application
   - Use the keyboard shortcuts to control the YouTube video
   - The controls work even if Chrome is minimized

### Enhanced Features

**Smart Video Detection**
- Automatically detects when YouTube videos are loaded and ready
- Provides feedback when videos aren't ready for control
- Handles dynamic content loading and page navigation

**Intelligent State Management**
- Tracks video loading and playback states
- Prevents commands when video isn't ready
- Automatic tab switching and reloading when needed

**Notification System**
- Get notified when you need to load a YouTube video first
- Click notifications to automatically go to YouTube
- Clear feedback about video states and control actions

### Supported YouTube Pages

- Regular YouTube videos (`youtube.com/watch`)
- YouTube Shorts (`youtube.com/shorts`)
- YouTube Music (limited support)

### Troubleshooting

**Shortcuts not working?**
- Ensure the extension is enabled in `chrome://extensions/`
- Check that you have a YouTube video loaded and ready
- Look for notifications that guide you to the right action
- Try refreshing the YouTube page
- Make sure no other application is capturing the same shortcuts

**Picture-in-Picture not working?**
- Ensure your browser supports Picture-in-Picture
- Check that the video is not DRM-protected
- Some videos may not support PiP due to YouTube restrictions
- Make sure the video is actively playing

**Extension not detecting YouTube videos?**
- Refresh the YouTube page
- Wait a few seconds for the video to fully load
- Check for notifications that indicate the video state
- Check the browser console for any error messages

## Technical Details

### Architecture

- **Manifest V3** - Uses the latest Chrome extension API
- **Service Worker** - Handles global shortcuts and tab management  
- **Content Script** - Interacts with YouTube pages
- **Injected Script** - Enhanced integration with YouTube's player API
- **Smart State Management** - Tracks video loading and playback states
- **Notification System** - Provides user feedback and guidance

### Enhanced YouTube Integration

- **Player API Integration** - Direct access to YouTube's internal player API
- **State Validation** - Ensures commands only execute when appropriate
- **Dynamic Content Handling** - Adapts to YouTube's dynamic page loading
- **Robust Error Recovery** - Automatic tab reloading and reconnection

### Permissions

- `activeTab` - Required to interact with YouTube tabs
- `tabs` - Needed to find and communicate with YouTube tabs
- `scripting` - Required to inject content scripts
- `notifications` - Used for user feedback and guidance
- `host_permissions` - Access to YouTube domains

### Files

- `manifest.json` - Extension configuration and permissions
- `background.js` - Service worker handling global commands and state management
- `content.js` - Content script for YouTube page interaction and video detection
- `injected.js` - Page-context script for enhanced YouTube API access

## Customization

### Changing Keyboard Shortcuts

1. Go to `chrome://extensions/shortcuts`
2. Find "YouTube Global Controls"
3. Click the pencil icon next to any shortcut
4. Set your preferred key combination
5. Click "OK" to save

**Available Commands:**
- Toggle Play/Pause
- Toggle Picture-in-Picture
- Skip backward 10 seconds
- Skip forward 10 seconds

### Modifying the Extension

The extension is built with modularity in mind:

- Modify `background.js` to change global behavior and state management
- Edit `content.js` to alter YouTube page interactions and video detection
- Update `injected.js` for enhanced YouTube API integration
- Adjust `manifest.json` for permissions and shortcuts

## Development

### Testing

1. Load the extension in developer mode
2. Open YouTube and play a video
3. Test each keyboard shortcut in different states
4. Verify notification system works correctly
5. Check the browser console for debug messages
6. Verify functionality works across different tabs/windows

### Debugging

- Open Chrome DevTools → Console to see debug messages
- Use `chrome://extensions/` to reload the extension after changes
- Check Background page for service worker logs
- Inspect YouTube pages to see content script logs
- Monitor notifications for state feedback

## Compatibility

- **Chrome Version**: 88+ (Manifest V3 support)
- **Operating Systems**: Windows, macOS, Linux
- **YouTube**: All standard video pages and Shorts

## Privacy

This extension:
- ✅ Only accesses YouTube pages you visit
- ✅ Does not collect or transmit any personal data
- ✅ Works entirely locally on your device
- ✅ No external network requests or analytics
- ✅ Notifications are generated locally for user guidance

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Look for helpful notifications from the extension
3. Reload the extension from `chrome://extensions/`
4. Refresh your YouTube tabs
5. Check for Chrome updates

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests to improve the extension.

---

**Note**: This extension is not affiliated with YouTube or Google. It's an independent tool designed to enhance your YouTube viewing experience.
