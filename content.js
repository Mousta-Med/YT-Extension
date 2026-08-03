// Content script for YouTube pages
(() => {
  'use strict';

  // This file is declared in the manifest AND injected programmatically as a
  // fallback for tabs that predate the extension. Without this guard the second
  // injection builds a duplicate controller and every command runs twice.
  if (window.__ytGlobalControlsLoaded) return;
  window.__ytGlobalControlsLoaded = true;

  class YouTubeController {
    constructor() {
      this.video = null;
      this.onPlaybackChange = () => this.reportPlaybackState();
      this.setupVideoDetection();
      this.setupMessageListener();
    }

    setupVideoDetection() {
      // YouTube mutates the DOM constantly, so coalesce bursts into one check
      // per frame instead of re-querying on every single mutation.
      let scheduled = false;
      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          this.attachToVideo();
        });
      };

      new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      this.attachToVideo();
    }

    // YouTube swaps the <video> element out on navigation, so rebind whenever
    // it changes. Bailing early when it hasn't keeps this cheap.
    attachToVideo() {
      const video = document.querySelector('video');
      if (video === this.video) return;

      if (this.video) {
        this.video.removeEventListener('play', this.onPlaybackChange);
        this.video.removeEventListener('pause', this.onPlaybackChange);
      }

      this.video = video;
      if (!video) return;

      // Listening to the element itself means clicking pause on the page is
      // reported too, not just the keyboard shortcut.
      video.addEventListener('play', this.onPlaybackChange);
      video.addEventListener('pause', this.onPlaybackChange);

      this.send({ action: 'youtube-tab-ready' });
      this.reportPlaybackState();
    }

    // Hover previews on the homepage and in search results are real <video>
    // elements; without this the tab would pin itself while merely browsing.
    isVideoPage() {
      return location.pathname.startsWith('/watch') ||
             location.pathname.startsWith('/shorts');
    }

    reportPlaybackState() {
      if (!this.video || !this.isVideoPage()) return;
      this.send({ action: 'video-state-changed', isPlaying: !this.video.paused });
    }

    send(message) {
      chrome.runtime.sendMessage(message).catch(() => {
        // Service worker asleep or extension reloaded — nothing to recover.
      });
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleCommand(message.action)
          .then(success => sendResponse({ success }))
          .catch(error => {
            console.error('Error in handleCommand:', error);
            sendResponse({ success: false });
          });
        return true; // Keep the message channel open for the async response
      });
    }

    async handleCommand(command) {
      if (!this.video) return false;

      try {
        switch (command) {
          case 'toggle-play-pause':
            return this.togglePlayPause();
          case 'toggle-pip':
            return await this.togglePictureInPicture();
          case 'backward-10s':
            return this.seekBy(-10);
          case 'forward-10s':
            return this.seekBy(10);
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
      if (!document.pictureInPictureEnabled || this.video.disablePictureInPicture) {
        return false;
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await this.video.requestPictureInPicture();
      }
      return true;
    }

    seekBy(seconds) {
      const duration = Number.isFinite(this.video.duration) ? this.video.duration : Infinity;
      this.video.currentTime = Math.min(duration, Math.max(0, this.video.currentTime + seconds));
      return true;
    }
  }

  new YouTubeController();
})();
