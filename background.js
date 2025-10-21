// Service worker for tracking tab relationships
// This runs in the background and listens to tab events

// Data structure: Store tabs as an object keyed by tab ID
// Each tab has: {id, title, url, parentId, timestamp, active}

// When extension is installed or updated, initialize storage if needed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Tab Journey Visualizer installed');

  // Get existing tabs and add them to storage
  const tabs = await chrome.tabs.query({});
  const tabData = {};

  for (const tab of tabs) {
    tabData[tab.id] = {
      id: tab.id,
      title: tab.title || 'Loading...',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || '',
      parentId: null, // Existing tabs don't have parent info
      timestamp: Date.now(),
      active: true
    };
  }

  // Store initial tab data
  await chrome.storage.local.set({ tabs: tabData });
});

// Listen for new tabs being created
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('Tab created:', tab.id, 'Parent:', tab.openerTabId);

  // Get current stored tabs
  const { tabs = {} } = await chrome.storage.local.get('tabs');

  // Add new tab to storage
  tabs[tab.id] = {
    id: tab.id,
    title: tab.title || 'Loading...',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl || '',
    parentId: tab.openerTabId || null, // openerTabId is the parent tab
    timestamp: Date.now(),
    active: true
  };

  // Save updated tabs
  await chrome.storage.local.set({ tabs });
});

// Listen for tab updates (title, URL changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when we have useful info
  if (!changeInfo.title && !changeInfo.url) return;

  console.log('Tab updated:', tabId, changeInfo);

  // Get current stored tabs
  const { tabs = {} } = await chrome.storage.local.get('tabs');

  // Update existing tab or create if it doesn't exist
  if (tabs[tabId]) {
    if (changeInfo.title) tabs[tabId].title = changeInfo.title;
    if (changeInfo.url) tabs[tabId].url = changeInfo.url;
    if (changeInfo.favIconUrl) tabs[tabId].favIconUrl = changeInfo.favIconUrl;
  } else {
    // Tab wasn't tracked yet, add it
    tabs[tabId] = {
      id: tabId,
      title: tab.title || 'Loading...',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || '',
      parentId: null,
      timestamp: Date.now(),
      active: true
    };
  }

  // Save updated tabs
  await chrome.storage.local.set({ tabs });
});

// Listen for tabs being closed
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('Tab removed:', tabId);

  // Get current stored tabs
  const { tabs = {} } = await chrome.storage.local.get('tabs');

  // Mark tab as inactive instead of deleting (to preserve history)
  if (tabs[tabId]) {
    tabs[tabId].active = false;
  }

  // Save updated tabs
  await chrome.storage.local.set({ tabs });
});

// When user clicks the extension icon, open the visualization in a new tab
chrome.action.onClicked.addListener(async () => {
  // Check if visualization tab is already open
  const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('view.html') });

  if (tabs.length > 0) {
    // Tab already exists, just focus it
    await chrome.tabs.update(tabs[0].id, { active: true });
  } else {
    // Create new tab with visualization
    await chrome.tabs.create({ url: 'view.html' });
  }
});
