// Injected script that runs in the page context for enhanced YouTube control
(function() {
  'use strict';

  class YouTubePageController {
    constructor() {
      this.player = null;
      this.setupPlayerDetection();
      this.setupMessageBridge();
    }

    setupPlayerDetection() {
      // Wait for YouTube player API
      const waitForPlayer = () => {
        if (window.yt && window.yt.player && window.yt.player.getPlayerByElement) {
          const playerElement = document.querySelector('#movie_player');
          if (playerElement) {
            this.player = window.yt.player.getPlayerByElement(playerElement);
            if (this.player) {
              console.log('YouTube player API detected');
              return;
            }
          }
        }
        
        // Fallback: check for player in global scope
        if (window.ytplayer && window.ytplayer.config) {
          console.log('YouTube player config detected');
        }
        
        setTimeout(waitForPlayer, 500);
      };
      
      waitForPlayer();
    }

    setupMessageBridge() {
      // Listen for messages from content script
      window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data.type === 'YOUTUBE_CONTROL') {
          return;
        }
        
        this.handlePageCommand(event.data.command);
      });
    }

    handlePageCommand(command) {
      switch (command) {
        case 'play':
          this.playVideo();
          break;
        case 'pause':
          this.pauseVideo();
          break;
        case 'toggle':
          this.togglePlayPause();
          break;
        case 'pip':
          this.enterPictureInPicture();
          break;
        case 'next':
          this.nextVideo();
          break;
        case 'previous':
          this.previousVideo();
          break;
      }
    }

    playVideo() {
      if (this.player && this.player.playVideo) {
        this.player.playVideo();
      } else {
        // Fallback to DOM method
        const video = document.querySelector('video');
        if (video) video.play();
      }
    }

    pauseVideo() {
      if (this.player && this.player.pauseVideo) {
        this.player.pauseVideo();
      } else {
        // Fallback to DOM method
        const video = document.querySelector('video');
        if (video) video.pause();
      }
    }

    togglePlayPause() {
      const video = document.querySelector('video');
      if (!video) return;

      if (video.paused) {
        this.playVideo();
      } else {
        this.pauseVideo();
      }
    }

    async enterPictureInPicture() {
      const video = document.querySelector('video');
      if (!video) return;

      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch (error) {
        console.error('PiP error:', error);
      }
    }

    nextVideo() {
      if (this.player && this.player.nextVideo) {
        this.player.nextVideo();
      } else {
        // Try clicking next button
        const nextBtn = document.querySelector('.ytp-next-button');
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
        }
      }
    }

    previousVideo() {
      if (this.player && this.player.previousVideo) {
        this.player.previousVideo();
      } else {
        // Try clicking previous button  
        const prevBtn = document.querySelector('.ytp-prev-button');
        if (prevBtn && !prevBtn.disabled) {
          prevBtn.click();
        }
      }
    }
  }

  // Enhanced video element detection
  function enhanceVideoControls() {
    const video = document.querySelector('video');
    if (!video) return;

    // Add custom properties for better control
    if (!video._ytGlobalControlsEnhanced) {
      video._ytGlobalControlsEnhanced = true;
      
      // Override play/pause methods for better tracking
      const originalPlay = video.play.bind(video);
      const originalPause = video.pause.bind(video);
      
      video.play = function() {
        console.log('Video play triggered via enhanced controls');
        return originalPlay();
      };
      
      video.pause = function() {
        console.log('Video pause triggered via enhanced controls');
        return originalPause();
      };
    }
  }

  // Initialize enhanced controls
  const pageController = new YouTubePageController();
  
  // Set up periodic enhancement
  setInterval(enhanceVideoControls, 2000);
  
  // Initial enhancement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceVideoControls);
  } else {
    enhanceVideoControls();
  }

  // Expose controller for debugging
  window.ytGlobalController = pageController;
  
})(); 