// Content script for YouTube pages
(() => {
  'use strict';

  // This file is declared in the manifest AND injected programmatically as a
  // fallback for tabs that predate the extension. Without a guard the second
  // injection builds a duplicate controller and every command runs twice.
  //
  // A plain boolean is not enough: reloading or updating the extension kills
  // the previous instance's message listener but leaves the flag on the page,
  // so re-injection would bail out and the tab would stay permanently deaf
  // until reloaded. Probing the old instance's chrome binding distinguishes a
  // live controller from an orphaned one.
  const previous = window.__ytGlobalControls;
  if (previous && previous.alive()) return;

  window.__ytGlobalControls = {
    alive() {
      try {
        return Boolean(chrome.runtime && chrome.runtime.id);
      } catch {
        return false; // context invalidated by an extension reload
      }
    }
  };

  class YouTubeController {
    constructor() {
      this.video = null;
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

      this.video = video;
      if (!video) return;

      this.send({ action: 'youtube-tab-ready' });
    }

    // Hover previews on the homepage and in search results are real <video>
    // elements; without this the tab could pin itself while merely browsing.
    isVideoPage() {
      return location.pathname.startsWith('/watch') ||
             location.pathname.startsWith('/shorts');
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
            return await this.togglePlayPause();
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

    // Pinning is reported only from here, never from the video's own play/pause
    // events: the tab should follow playback the user drove with the shortcut,
    // not autoplay, ads, or a click on the page itself.
    async togglePlayPause() {
      const willPlay = this.video.paused;

      if (willPlay) {
        try {
          // play() returns a promise that Chrome's autoplay policy can reject
          // in a tab the user has never interacted with. Awaiting it means a
          // refusal is reported instead of pinning a tab that never started.
          await this.video.play();
        } catch (error) {
          console.error('play() was refused:', error);
          return false;
        }
      } else {
        this.video.pause();
      }

      if (this.isVideoPage()) {
        this.send({ action: 'video-state-changed', isPlaying: willPlay });
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
