// Content script for YouTube pages
class YouTubeController {
  constructor() {
    this.video = null;
    this.setupVideoDetection();
    this.setupMessageListener();
    this.injectVideoScript();
  }

  setupVideoDetection() {
    const checkForVideo = () => {
      this.video = document.querySelector('video');
      if (this.video) {
        this.notifyBackgroundReady();
      }
    };

    // Check immediately
    checkForVideo();

    // Set up observer for dynamic content
    const observer = new MutationObserver(checkForVideo);
    observer.observe(document.body, { childList: true, subtree: true });

    // Also check periodically as fallback
    setInterval(checkForVideo, 2000);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleCommand(message.action).then(result => {
      sendResponse({ success: result });
      }).catch(error => {
        console.error('Error in handleCommand:', error);
        sendResponse({ success: false });
      });
      return true; // Keep the message channel open for async response
    });
  }

  notifyBackgroundReady() {
    chrome.runtime.sendMessage({
      action: 'youtube-tab-ready'
    }).catch(() => {
      // Silent error handling
    });
  }

  async handleCommand(command) {
    if (!this.video) {
      return false;
    }

    try {
      let result = false;
      switch (command) {
        case 'toggle-play-pause':
          result = this.togglePlayPause();
          // Send video state for pin/unpin logic
          if (result) {
            chrome.runtime.sendMessage({
              action: 'video-state-changed',
              command: command,
              isPlaying: !this.video.paused // Video state after toggle
            }).catch(() => {
              // Silent error handling
            });
          }
          break;
        case 'toggle-pip':
          result = await this.togglePictureInPicture();
          // PIP doesn't affect pinning, so no message sent
          break;
        case 'backward-10s':
          result = this.skipBackward10s();
          break;
        case 'forward-10s':
          result = this.skipForward10s();
          break;
        default:
          return false;
      }

      return result;
    } catch (error) {
      console.error('Error handling command:', command, error);
      return false;
    }
  }

  togglePlayPause() {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
    return true;
  }

  async togglePictureInPicture() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        // Configure PiP with smallest possible dimensions
        const pipOptions = {
          width: 160,
          height: 90,
          // Alternative: use aspect ratio of 16:9 with minimum size
          // width: 240,
          // height: 135
        };
        
        await this.video.requestPictureInPicture(pipOptions);
        
        // Additional size optimization after PiP is active
        if (document.pictureInPictureElement) {
          // Try to resize the PiP window to minimum size
          this.optimizePipSize();
        }
      }
      return true;
    } catch (error) {
      console.error('Picture-in-Picture error:', error);
      // Fallback to standard PiP without options
      try {
        await this.video.requestPictureInPicture();
        if (document.pictureInPictureElement) {
          this.optimizePipSize();
        }
        return true;
      } catch (fallbackError) {
        console.error('Fallback PiP error:', fallbackError);
        return false;
      }
    }
  }

  optimizePipSize() {
    // Set up resize event listener for PiP window
    if (document.pictureInPictureElement) {
      const pipElement = document.pictureInPictureElement;
      
      // Listen for PiP resize events
      pipElement.addEventListener('resize', () => {
        // Ensure minimum size is maintained
        if (pipElement.videoWidth && pipElement.videoHeight) {
          const minWidth = 100;
          const minHeight = 50;
          
          if (pipElement.videoWidth < minWidth || pipElement.videoHeight < minHeight) {
            // Browser will automatically maintain aspect ratio
            // This is just for logging/debugging
            console.log('PiP window resized to minimum dimensions');
          }
        }
      });
    }
  }

  skipBackward10s() {
    try {
      this.video.currentTime = Math.max(0, this.video.currentTime - 10);
      return true;
    } catch (error) {
      // Fallback: keyboard shortcut
      this.simulateKeyPress('ArrowLeft');
      return true;
    }
  }

  skipForward10s() {
    try {
      this.video.currentTime = Math.min(this.video.duration || Infinity, this.video.currentTime + 10);
      return true;
    } catch (error) {
      // Fallback: keyboard shortcut
      this.simulateKeyPress('ArrowRight');
      return true;
    }
  }

  simulateKeyPress(key) {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: key,
      bubbles: true,
      cancelable: true
    }));
  }

  injectVideoScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }
}

// Initialize controller
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new YouTubeController());
} else {
  new YouTubeController();
} 