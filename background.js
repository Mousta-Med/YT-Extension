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
      console.error('Error finding YouTube tabs:', error);
    }
  }

  async handleCommand(command) {
    if (!this.youtubeTabId) {
      await this.findActiveYouTubeTab();
    }

    if (!this.youtubeTabId) {
      console.log('No active YouTube tab found');
      return;
    }

    try {
      await chrome.tabs.sendMessage(this.youtubeTabId, {
        action: command
      });
    } catch (error) {
      console.error(`Error executing command ${command}:`, error);
      // Tab might be closed or navigated away, try to find another YouTube tab
      await this.findActiveYouTubeTab();
      if (this.youtubeTabId) {
        try {
          await chrome.tabs.sendMessage(this.youtubeTabId, {
            action: command
          });
        } catch (retryError) {
          console.error(`Retry failed for command ${command}:`, retryError);
        }
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