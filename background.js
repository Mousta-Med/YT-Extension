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

    // Track YouTube tabs
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.isYouTubeUrl(tab.url)) {
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

  async findActiveYouTubeTab() {
    try {
      const tabs = await chrome.tabs.query({});
      const youTubeTabs = tabs.filter(tab => this.isYouTubeUrl(tab.url));
      
      if (youTubeTabs.length > 0) {
        // Prefer the most recently active YouTube tab
        const sortedTabs = youTubeTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
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
    try {
      // Get the current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (activeTab) {
        // Try to inject script to show alert on the current page
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
              alert('You have to play a YouTube video first');
            }
          });
        } catch (scriptError) {
          // If script injection fails, use notification as fallback
          this.showNotification();
        }
      } else {
        // No active tab, use notification
        this.showNotification();
      }
    } catch (error) {
      // Fallback to notification
      this.showNotification();
    }
  }

  showNotification() {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'YouTube Global Controls',
        message: 'You have to play a YouTube video first'
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
      await chrome.tabs.sendMessage(this.youtubeTabId, {
        action: command
      });
    } catch (error) {
      // Connection not established - go to YouTube tab and reload it
      await this.goToYouTubeTabAndReload();
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