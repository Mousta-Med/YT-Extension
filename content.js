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
      const result = this.handleCommand(message.action);
      sendResponse({ success: result });
      return true;
    });
  }

  notifyBackgroundReady() {
    chrome.runtime.sendMessage({
      action: 'youtube-tab-ready'
    }).catch(() => {
      // Silent error handling
    });
  }

  handleCommand(command) {
    if (!this.video) {
      return false;
    }

    try {
      switch (command) {
        case 'toggle-play-pause':
          return this.togglePlayPause();
        case 'toggle-pip':
          return this.togglePictureInPicture();
        case 'backward-10s':
          return this.skipBackward10s();
        case 'forward-10s':
          return this.skipForward10s();
        default:
          return false;
      }
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
        await this.video.requestPictureInPicture();
      }
      return true;
    } catch (error) {
      console.error('Picture-in-Picture error:', error);
      return false;
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