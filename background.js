// Background service worker for YouTube Global Controls
class YouTubeGlobalControls {
  constructor() {
    this.youtubeTabId = null;
    this.isYouTubeTabActive = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for command shortcuts
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    // Listen for notification clicks
    chrome.notifications.onClicked.addListener((notificationId) => {
      this.handleNotificationClick(notificationId);
    });

    // Listen for notification button clicks
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      this.handleNotificationClick(notificationId);
    });

    // Track YouTube tabs
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
        this.youtubeTabId = tabId;
        this.isYouTubeTabActive = true;
      }
    });

    // Clean up when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId === this.youtubeTabId) {
        this.youtubeTabId = null;
        this.isYouTubeTabActive = false;
        this.findActiveYouTubeTab();
      }
    });

    // Handle tab activation
    chrome.tabs.onActivated.addListener(() => {
      this.findActiveYouTubeTab();
    });

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'youtube-tab-ready') {
        this.youtubeTabId = sender.tab.id;
        this.isYouTubeTabActive = true;
      }
      return true;
    });
  }

  isYouTubeUrl(url) {
    return url && (url.includes('youtube.com/watch') || url.includes('youtube.com/shorts'));
  }

  isYouTubeVideoUrl(url) {
    return url && (url.includes('youtube.com/watch') || url.includes('youtube.com/shorts'));
  }

  isYouTubeHomeUrl(url) {
    return url && (url.includes('youtube.com') && !this.isYouTubeVideoUrl(url));
  }

  async findActiveYouTubeTab() {
    try {
      const tabs = await chrome.tabs.query({});
      // Find any YouTube tab (video pages, home page, etc.)
      const youTubeTabs = tabs.filter(tab => tab.url && tab.url.includes('youtube.com'));
      
      if (youTubeTabs.length > 0) {
        // Prefer video tabs first, then any YouTube tab
        const videoTabs = youTubeTabs.filter(tab => this.isYouTubeVideoUrl(tab.url));
        const tabsToConsider = videoTabs.length > 0 ? videoTabs : youTubeTabs;
        
        // Prefer the most recently active YouTube tab
        const sortedTabs = tabsToConsider.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
        this.youtubeTabId = sortedTabs[0].id;
        this.isYouTubeTabActive = true;
      } else {
        this.youtubeTabId = null;
        this.isYouTubeTabActive = false;
      }
    } catch (error) {
      // Silent error handling as requested
    }
  }

  async openYouTubeTab() {
    try {
      const tab = await chrome.tabs.create({
        url: 'https://www.youtube.com',
        active: true
      });
      this.youtubeTabId = tab.id;
      this.isYouTubeTabActive = true;
    } catch (error) {
      // Silent error handling as requested
    }
  }

  async goToYouTubeTabAndReload() {
    try {
      if (this.youtubeTabId) {
        // Reload the YouTube tab without switching to it
        await chrome.tabs.reload(this.youtubeTabId);
      } else {
        // If no YouTube tab, find one or create one
        await this.findActiveYouTubeTab();
        if (this.youtubeTabId) {
          await chrome.tabs.reload(this.youtubeTabId);
        } else {
          await this.openYouTubeTab();
        }
      }
    } catch (error) {
      // Silent error handling as requested
    }
  }

  async showYouTubeRequiredAlert() {
    // Always use notification for consistency and clickability
    this.showNotification('You have to play a YouTube video first', 'youtube-required');
  }

  async showVideoNotLoadedAlert() {
    // Always use notification for consistency and clickability
    this.showNotificationVideoNotLoaded();
  }

  async showVideoNotRunningAlert() {
    // Always use notification for consistency and clickability
    this.showNotificationVideoNotRunning();
  }

  showNotification(message = 'You have to play a YouTube video first', notificationId = 'youtube-controls') {
    try {
      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'YouTube Global Controls',
        message: message,
        buttons: [
          { title: 'Go to YouTube' }
        ]
      });
    } catch (notificationError) {
      // Silent error handling as requested
    }
  }

  async handleCommand(command) {
    if (!this.youtubeTabId) {
      await this.findActiveYouTubeTab();
    }

    if (!this.youtubeTabId) {
      // Show alert that user must open YouTube first
      await this.showYouTubeRequiredAlert();
      return;
    }

    try {
      // First check if the video is running/loaded
      const videoState = await this.checkVideoState();
      
      if (!videoState.isLoaded) {
        await this.showVideoNotLoadedAlert();
        return;
      }
      
      if (!videoState.isRunning && this.requiresRunningVideo(command)) {
        await this.showVideoNotRunningAlert();
        return;
      }

      await chrome.tabs.sendMessage(this.youtubeTabId, {
        action: command
      });
    } catch (error) {
      // Connection not established - go to YouTube tab and reload it
      await this.goToYouTubeTabAndReload();
    }
  }

  async checkVideoState() {
    try {
      const response = await chrome.tabs.sendMessage(this.youtubeTabId, {
        action: 'check-video-state'
      });
      return response || { isLoaded: false, isRunning: false };
    } catch (error) {
      return { isLoaded: false, isRunning: false };
    }
  }

  requiresRunningVideo(command) {
    // Commands that require a video to be actually playing/running
    const runningRequiredCommands = [
      'backward-10s',
      'forward-10s',
      'toggle-pip'
    ];
    return runningRequiredCommands.includes(command);
  }

  showNotificationVideoNotLoaded() {
    try {
      chrome.notifications.create('video-not-loaded', {
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'YouTube Global Controls',
        message: 'YouTube video is not loaded. Please visit the YouTube tab and load a video first.',
        buttons: [
          { title: 'Go to YouTube' }
        ]
      });
    } catch (notificationError) {
      // Silent error handling as requested
    }
  }

  showNotificationVideoNotRunning() {
    try {
      chrome.notifications.create('video-not-running', {
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'YouTube Global Controls',
        message: 'YouTube video is not running. Please start playing a video first.',
        buttons: [
          { title: 'Go to YouTube' }
        ]
      });
    } catch (notificationError) {
      // Silent error handling as requested
    }
  }

  async handleNotificationClick(notificationId) {
    try {
      // Clear the notification
      chrome.notifications.clear(notificationId);
      
      // Navigate to YouTube
      await this.navigateToYouTube();
    } catch (error) {
      // Silent error handling as requested
    }
  }

  async navigateToYouTube() {
    try {
      if (this.youtubeTabId) {
        // Get the current tab info to check its URL
        const tab = await chrome.tabs.get(this.youtubeTabId);
        
        // Check if the tab is on a video page (watch or shorts)
        if (this.isYouTubeVideoUrl(tab.url)) {
          // Tab is on a video page - navigate to it AND reload it
          await chrome.tabs.update(this.youtubeTabId, { active: true });
          await chrome.windows.update(tab.windowId, { focused: true });
          await chrome.tabs.reload(this.youtubeTabId);
        } else {
          // Tab is on YouTube but not a video page (home page, etc.) - just navigate to it
          await chrome.tabs.update(this.youtubeTabId, { active: true });
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      } else {
        // Find any YouTube tab
        await this.findActiveYouTubeTab();
        
        if (this.youtubeTabId) {
          // Get the found tab info to check its URL
          const tab = await chrome.tabs.get(this.youtubeTabId);
          
          // Check if the found tab is on a video page
          if (this.isYouTubeVideoUrl(tab.url)) {
            // Tab is on a video page - navigate to it AND reload it
            await chrome.tabs.update(this.youtubeTabId, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
            await chrome.tabs.reload(this.youtubeTabId);
          } else {
            // Tab is on YouTube but not a video page - just navigate to it
            await chrome.tabs.update(this.youtubeTabId, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
          }
        } else {
          // Create new YouTube tab (will go to home page by default)
          await this.openYouTubeTab();
        }
      }
    } catch (error) {
      // Fallback: just open a new YouTube tab
      try {
        await this.openYouTubeTab();
      } catch (fallbackError) {
        // Silent error handling as requested
      }
    }
  }
}

// Initialize the background service
const youtubeControls = new YouTubeGlobalControls();

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  youtubeControls.findActiveYouTubeTab();
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  youtubeControls.findActiveYouTubeTab();
}); 