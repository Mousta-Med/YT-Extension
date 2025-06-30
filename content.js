// Content script for YouTube pages
class YouTubeController {
  constructor() {
    this.video = null;
    this.isReady = false;
    this.setupVideoDetection();
    this.setupMessageListener();
    this.injectVideoScript();
    this.setupEnhancedStateListener();
  }

  setupVideoDetection() {
    // Wait for video element to be available
    const checkForVideo = () => {
      this.video = document.querySelector('video');
      if (this.video && !this.isReady) {
        this.isReady = true;
        this.notifyBackgroundReady();
        console.log('YouTube video detected and ready for control');
      }
    };

    // Check immediately
    checkForVideo();

    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
      if (!this.video || !document.contains(this.video)) {
        checkForVideo();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check periodically as a fallback
    setInterval(checkForVideo, 1000);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'check-video-state') {
        const videoState = this.getEnhancedVideoState();
        sendResponse(videoState);
      } else {
        const result = this.handleCommand(message.action);
        sendResponse({ success: result });
      }
      return true;
    });
  }

  notifyBackgroundReady() {
    chrome.runtime.sendMessage({
      action: 'youtube-tab-ready'
    }).catch(error => {
      // Silent error handling as requested
    });
  }

  getVideoState() {
    if (!this.video) {
      return { isLoaded: false, isRunning: false };
    }

    const isLoaded = this.video.readyState >= 2; // HAVE_CURRENT_DATA or higher
    const isRunning = !this.video.paused && !this.video.ended && this.video.currentTime > 0;
    const hasValidSrc = this.video.src || this.video.currentSrc;

    let videoState = {
      isLoaded: isLoaded && hasValidSrc,
      isRunning: isRunning,
      currentTime: this.video.currentTime,
      duration: this.video.duration,
      paused: this.video.paused,
      ended: this.video.ended,
      readyState: this.video.readyState
    };

    // Try to get enhanced state from injected script
    try {
      window.postMessage({
        type: 'YOUTUBE_CONTROL',
        command: 'get-player-state'
      }, '*');
      
      // Note: This is async but we return the basic state immediately
      // The enhanced state will be available for future calls
    } catch (error) {
      // Silently handle errors
    }

    return videoState;
  }

  setupEnhancedStateListener() {
    // Listen for enhanced state from injected script
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.data.type !== 'YOUTUBE_CONTROL_RESPONSE') {
        return;
      }
      
      // Store enhanced state for future use
      this.enhancedVideoState = event.data.state;
    });
  }

  getEnhancedVideoState() {
    // Return enhanced state if available, otherwise fall back to basic state
    if (this.enhancedVideoState) {
      return this.enhancedVideoState;
    }
    return this.getVideoState();
  }

  handleCommand(command) {
    if (!this.video) {
      console.log('Video element not found');
      return false;
    }

    // Check if video is loaded for commands that need it
    const videoState = this.getEnhancedVideoState();
    if (!videoState.isLoaded) {
      console.log('Video not loaded, cannot execute command:', command);
      return false;
    }

    try {
      switch (command) {
        case 'toggle-play-pause':
          return this.togglePlayPause();
        case 'toggle-pip':
          return this.togglePictureInPicture();
        case 'next-video':
          return this.nextVideo();
        case 'previous-video':
          return this.previousVideo();
        case 'backward-10s':
          return this.skipBackward10s();
        case 'forward-10s':
          return this.skipForward10s();
        default:
          console.log('Unknown command:', command);
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
      console.log('Video played');
    } else {
      this.video.pause();
      console.log('Video paused');
    }
    return true;
  }

  async togglePictureInPicture() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        console.log('Exited Picture-in-Picture');
      } else {
        await this.video.requestPictureInPicture();
        console.log('Entered Picture-in-Picture');
      }
      return true;
    } catch (error) {
      console.error('Picture-in-Picture error:', error);
      return false;
    }
  }

  nextVideo() {
    // Try multiple selectors for the next button
    const nextSelectors = [
      '.ytp-next-button',
      '[data-title="Next"]',
      '.ytp-button[title*="Next"]',
      'button[title*="Next"]'
    ];

    for (const selector of nextSelectors) {
      const nextButton = document.querySelector(selector);
      if (nextButton && !nextButton.disabled) {
        nextButton.click();
        console.log('Next video clicked');
        return true;
      }
    }

    // Fallback: try keyboard shortcut
    this.simulateKeyPress('n');
    console.log('Next video (keyboard shortcut)');
    return true;
  }

  previousVideo() {
    // Try multiple selectors for the previous button
    const prevSelectors = [
      '.ytp-prev-button',
      '[data-title="Previous"]',
      '.ytp-button[title*="Previous"]',
      'button[title*="Previous"]'
    ];

    for (const selector of prevSelectors) {
      const prevButton = document.querySelector(selector);
      if (prevButton && !prevButton.disabled) {
        prevButton.click();
        console.log('Previous video clicked');
        return true;
      }
    }

    // Fallback: try keyboard shortcut
    this.simulateKeyPress('p');
    console.log('Previous video (keyboard shortcut)');
    return true;
  }

  skipBackward10s() {
    if (!this.video) {
      console.log('Video element not found');
      return false;
    }

    try {
      // Skip backward 10 seconds
      this.video.currentTime = Math.max(0, this.video.currentTime - 10);
      console.log('Skipped backward 10 seconds');
      return true;
    } catch (error) {
      console.error('Error skipping backward:', error);
      // Fallback: try keyboard shortcut (left arrow key)
      this.simulateKeyPress('ArrowLeft');
      console.log('Backward skip (keyboard shortcut)');
      return true;
    }
  }

  skipForward10s() {
    if (!this.video) {
      console.log('Video element not found');
      return false;
    }

    try {
      // Skip forward 10 seconds
      this.video.currentTime = Math.min(this.video.duration || Infinity, this.video.currentTime + 10);
      console.log('Skipped forward 10 seconds');
      return true;
    } catch (error) {
      console.error('Error skipping forward:', error);
      // Fallback: try keyboard shortcut (right arrow key)
      this.simulateKeyPress('ArrowRight');
      console.log('Forward skip (keyboard shortcut)');
      return true;
    }
  }

  simulateKeyPress(key) {
    const event = new KeyboardEvent('keydown', {
      key: key,
      code: `Key${key.toUpperCase()}`,
      keyCode: key.charCodeAt(0),
      which: key.charCodeAt(0),
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  injectVideoScript() {
    // Inject additional script for deeper YouTube integration
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }
}

// Initialize the controller when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeController();
  });
} else {
  new YouTubeController();
} 