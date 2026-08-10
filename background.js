// Background service worker for YouTube Global Controls
class YouTubeGlobalControls {
  constructor() {
    this.youtubeTabId = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Returning the promise keeps the service worker alive until the command
    // finishes. Dropping it lets Chrome tear the worker down mid-await on a
    // cold start, which silently swallows the first press after an idle period.
    chrome.commands.onCommand.addListener((command) => this.handleCommand(command));

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

    // These are fire-and-forget notifications. Returning true would promise a
    // sendResponse that never comes, holding the channel open until it times
    // out and rejects on the sender's side.
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (!sender.tab) return;

      if (message.action === 'youtube-tab-ready') {
        this.youtubeTabId = sender.tab.id;
      } else if (message.action === 'video-state-changed') {
        this.handleVideoStateChange(message.isPlaying, sender.tab.id);
      }
    });
  }

  // Matches exactly what the manifest grants access to. A substring check would
  // also match hostnames like "youtube.com.example.net".
  isYouTubeUrl(url) {
    if (!url) return false;
    try {
      const { protocol, hostname } = new URL(url);
      return protocol === 'https:' &&
        (hostname === 'youtube.com' || hostname === 'www.youtube.com');
    } catch {
      return false;
    }
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

  // Delivers to the currently cached tab. Returns false rather than throwing so
  // the caller can decide whether a different tab is worth trying.
  async deliver(command) {
    if (!this.youtubeTabId) return false;

    try {
      await chrome.tabs.sendMessage(this.youtubeTabId, { action: command });
      return true;
    } catch {
      // No live content script there: a restored tab, or the extension was
      // reloaded. Inject and retry once before giving up on this tab.
      try {
        await chrome.scripting.executeScript({
          target: { tabId: this.youtubeTabId },
          files: ['content.js']
        });
        await chrome.tabs.sendMessage(this.youtubeTabId, { action: command });
        return true;
      } catch {
        return false;
      }
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
    // The cached id can be stale: onRemoved only covers closed tabs, so a tab
    // navigated away from YouTube stays cached and swallows every command. Try
    // it first, then re-resolve and retry rather than giving up on one failure.
    if (await this.deliver(command)) return;

    await this.findActiveYouTubeTab();

    if (!this.youtubeTabId) {
      this.showNotification('Please open a YouTube tab first');
      return;
    }

    if (!await this.deliver(command)) {
      this.showNotification('Failed to control YouTube. Please visit the YouTube tab first.');
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

  // The tab's pinned state simply mirrors whether the video is playing.
  async handleVideoStateChange(isPlaying, tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.pinned !== isPlaying) {
        await chrome.tabs.update(tabId, { pinned: isPlaying });
      }
    } catch (error) {
      console.error('Error handling video state change:', error);
    }
  }
}

// Initialize the controller
new YouTubeGlobalControls();