// Background service worker for YouTube Global Controls
class YouTubeGlobalControls {
  constructor() {
    this.youtubeTabId = null;
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
      if (changeInfo.status === 'complete' && this.isYouTubeUrl(tab.url)) {
        this.youtubeTabId = tabId;
      }
    });

    // Clean up when YouTube tab is closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId === this.youtubeTabId) {
        this.youtubeTabId = null;
        this.findActiveYouTubeTab();
      }
    });

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'youtube-tab-ready') {
        this.youtubeTabId = sender.tab.id;
      }
      return true;
    });
  }

  isYouTubeUrl(url) {
    return url && url.includes('youtube.com');
  }

  async findActiveYouTubeTab() {
    try {
      const tabs = await chrome.tabs.query({});
      const youTubeTabs = tabs.filter(tab => this.isYouTubeUrl(tab.url));
      
      if (youTubeTabs.length > 0) {
        // Prefer video tabs, then most recently accessed
        const videoTabs = youTubeTabs.filter(tab => 
          tab.url.includes('/watch') || tab.url.includes('/shorts')
        );
        const tabsToConsider = videoTabs.length > 0 ? videoTabs : youTubeTabs;
        
        const sortedTabs = tabsToConsider.sort((a, b) => 
          (b.lastAccessed || 0) - (a.lastAccessed || 0)
        );
        this.youtubeTabId = sortedTabs[0].id;
      } else {
        this.youtubeTabId = null;
      }
    } catch (error) {
      console.error('Error finding YouTube tab:', error);
    }
  }

  async injectContentScriptAndExecute(command) {
    if (!this.youtubeTabId) return;

    try {
      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: this.youtubeTabId },
        files: ['content.js']
      });

      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send command
      await chrome.tabs.sendMessage(this.youtubeTabId, {
        action: command
      });
    } catch (error) {
      throw new Error(`Failed to inject and execute: ${error.message}`);
    }
  }

  showNotification(message, notificationId = 'youtube-controls') {
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'YouTube Global Controls',
      message: message,
      buttons: [{ title: 'Go to YouTube' }]
    });
  }

  async handleCommand(command) {
    if (!this.youtubeTabId) {
      await this.findActiveYouTubeTab();
    }

    if (!this.youtubeTabId) {
      this.showNotification('Please open a YouTube tab first');
      return;
    }

    try {
      // Try to send message to existing content script
      await chrome.tabs.sendMessage(this.youtubeTabId, { action: command });
    } catch (error) {
      // Content script not loaded - inject it and try again
      try {
        await this.injectContentScriptAndExecute(command);
      } catch (injectError) {
        this.showNotification('Failed to control YouTube. Please visit the YouTube tab first.');
      }
    }
  }

  async handleNotificationClick(notificationId) {
    try {
      chrome.notifications.clear(notificationId);
      
      if (this.youtubeTabId) {
        await chrome.tabs.update(this.youtubeTabId, { active: true });
      } else {
        await chrome.tabs.create({ url: 'https://www.youtube.com', active: true });
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  }
}

// Initialize the controller
new YouTubeGlobalControls();