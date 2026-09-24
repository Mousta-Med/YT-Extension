// Background service worker for YouTube Global Controls

// Commands that drive YouTube's own player API instead of the <video> element.
// That API lives on the player element in the page's main world, out of reach
// of the isolated content script, so these are injected with chrome.scripting.
// Going through the API keeps YouTube's controls, settings menu and remembered
// volume and speed in step, which poking the <video> element directly would not.
const PLAYER_COMMANDS = new Set([
  'next-video',
  'previous-video',
  'toggle-mute',
  'volume-up',
  'volume-down',
  'speed-up',
  'speed-down'
]);

// Runs inside the YouTube page (world: 'MAIN'). Chrome serializes this function
// into the page, so it must not reference anything outside its own body.
function runPlayerCommand(command) {
  const VOLUME_STEP = 10;

  // Shorts pages keep a hidden #movie_player around too, so pick by page.
  const onShorts = location.pathname.startsWith('/shorts/');
  const player = document.getElementById(onShorts ? 'shorts-player' : 'movie_player');
  if (typeof player?.getVideoData !== 'function' || !player.getVideoData()?.video_id) {
    return false;
  }

  // The Shorts player ignores nextVideo(); the feed moves through its own
  // up/down buttons instead.
  const clickShortsButton = (id) => {
    const button = document.querySelector(`#${id} button`);
    if (!button) return false;
    button.click();
    return true;
  };

  const videoIdOf = (url) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname === '/watch') return searchParams.get('v');
    if (pathname.startsWith('/shorts/')) return pathname.split('/')[2] || null;
    return null;
  };

  // previousVideo() only steps back inside a playlist, and does nothing on its
  // first item. Otherwise "previous" means the video this tab showed before, so
  // go back through history, but only when that entry really is another video.
  // Blindly calling history.back() could land on the homepage or leave YouTube.
  const previousVideo = () => {
    if (player.getPlaylistIndex?.() > 0) {
      player.previousVideo();
      return true;
    }

    // The Navigation API only lists this tab's same-origin entries, so an
    // entry from another site never shows up here to be mistaken for a video.
    const nav = window.navigation;
    const previous = nav?.currentEntry && nav.entries()[nav.currentEntry.index - 1];
    const previousId = previous?.url && videoIdOf(previous.url);
    if (!previousId || previousId === player.getVideoData().video_id) return false;

    history.back();
    return true;
  };

  // Steps through the same speeds as YouTube's settings menu and its < > keys.
  const stepSpeed = (faster) => {
    const rates = player.getAvailablePlaybackRates();
    const current = player.getPlaybackRate();
    const target = faster
      ? rates.find(rate => rate > current)
      : rates.findLast(rate => rate < current);
    if (target === undefined) return false; // already at the fastest or slowest
    player.setPlaybackRate(target);
    return true;
  };

  switch (command) {
    case 'next-video':
      if (onShorts) return clickShortsButton('navigation-button-down');
      player.nextVideo();
      return true;
    case 'previous-video':
      return onShorts ? clickShortsButton('navigation-button-up') : previousVideo();
    case 'toggle-mute':
      if (player.isMuted()) player.unMute();
      else player.mute();
      return true;
    case 'volume-up':
      // Raising the volume while muted should be audible, as with YouTube's
      // own arrow keys.
      player.unMute();
      player.setVolume(Math.min(100, player.getVolume() + VOLUME_STEP));
      return true;
    case 'volume-down':
      player.setVolume(Math.max(0, player.getVolume() - VOLUME_STEP));
      return true;
    case 'speed-up':
      return stepSpeed(true);
    case 'speed-down':
      return stepSpeed(false);
    default:
      return false;
  }
}

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
    if (PLAYER_COMMANDS.has(command)) return this.runInPage(command);

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

  // Needs no content script, so there is nothing to inject and retry. Failing
  // here means the cached tab is gone or no longer on YouTube, where the host
  // permission stops the injection.
  async runInPage(command) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.youtubeTabId },
        world: 'MAIN',
        func: runPlayerCommand,
        args: [command]
      });
      return true;
    } catch {
      return false;
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