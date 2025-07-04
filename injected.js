// Injected script for enhanced YouTube control
(function() {
  'use strict';

  class YouTubePageController {
    constructor() {
      this.player = null;
      this.setupPlayerDetection();
    }

    setupPlayerDetection() {
      const waitForPlayer = () => {
        // Try to get YouTube player API
        if (window.yt && window.yt.player && window.yt.player.getPlayerByElement) {
          const playerElement = document.querySelector('#movie_player');
          if (playerElement) {
            this.player = window.yt.player.getPlayerByElement(playerElement);
            if (this.player) {
              return; // Player found
            }
          }
        }
        
        // Keep checking for player
        setTimeout(waitForPlayer, 1000);
      };
      
      waitForPlayer();
    }

    skipBackward10s() {
      const video = document.querySelector('video');
      if (!video) return;

      try {
        if (this.player && this.player.getCurrentTime && this.player.seekTo) {
          const currentTime = this.player.getCurrentTime();
          const newTime = Math.max(0, currentTime - 10);
          this.player.seekTo(newTime, true);
        } else {
          video.currentTime = Math.max(0, video.currentTime - 10);
        }
      } catch (error) {
        // Fallback to video element
        video.currentTime = Math.max(0, video.currentTime - 10);
      }
    }

    skipForward10s() {
      const video = document.querySelector('video');
      if (!video) return;

      try {
        if (this.player && this.player.getCurrentTime && this.player.seekTo && this.player.getDuration) {
          const currentTime = this.player.getCurrentTime();
          const duration = this.player.getDuration();
          const newTime = Math.min(duration, currentTime + 10);
          this.player.seekTo(newTime, true);
        } else {
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
        }
      } catch (error) {
        // Fallback to video element
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
      }
    }
  }

  // Initialize controller
  new YouTubePageController();
  
})(); 