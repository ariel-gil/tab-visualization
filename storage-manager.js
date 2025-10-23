// storage-manager.js - Handles all storage operations (session save/load, sync, clear)

// Save session to file
async function saveSession() {
  try {
    const { tabs, canvasData, darkMode } = await chrome.storage.local.get(['tabs', 'canvasData', 'darkMode']);

    const sessionData = {
      version: '1.0',
      timestamp: Date.now(),
      tabs,
      canvasData,
      darkMode,
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-journey-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('Session saved successfully');
  } catch (error) {
    console.error('Error saving session:', error);
    alert('Failed to save session: ' + error.message);
  }
}

// Load session from file
async function loadSession(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const sessionData = JSON.parse(text);

    // Validate session data
    if (!sessionData.tabs) {
      throw new Error('Invalid session file: missing tabs data');
    }

    // Confirm before loading (will replace current data)
    if (!confirm('Loading this session will replace your current tab data. Continue?')) {
      return;
    }

    // Create backup of current data before loading
    const { tabs: currentTabs, canvasData: currentCanvasData } = await chrome.storage.local.get(['tabs', 'canvasData']);
    const backup = {
      tabs: currentTabs,
      canvasData: currentCanvasData,
      timestamp: Date.now()
    };
    console.log('Backup created before loading session:', backup);

    // Restore session data
    const dataToRestore = {
      tabs: sessionData.tabs,
      canvasData: sessionData.canvasData || { positions: {}, groups: {}, comments: {} },
      darkMode: sessionData.darkMode || false
    };

    await chrome.storage.local.set(dataToRestore);

    // Reload the view
    window.location.reload();
  } catch (error) {
    console.error('Error loading session:', error);
    alert('Failed to load session: ' + error.message);
  }
}

// Sync from browser - get all currently open tabs
async function syncFromBrowser() {
  try {
    // Get all currently open tabs across all windows
    const browserTabs = await chrome.tabs.query({});
    const { tabs: storedTabs = {} } = await chrome.storage.local.get('tabs');

    // Mark all stored tabs as inactive first
    Object.values(storedTabs).forEach(tab => {
      tab.active = false;
    });

    // Update stored tabs with current browser state
    for (const browserTab of browserTabs) {
      if (storedTabs[browserTab.id]) {
        // Tab already tracked, update its data
        storedTabs[browserTab.id] = {
          ...storedTabs[browserTab.id], // Preserve existing properties like parentId and comment
          title: browserTab.title || 'Loading...',
          url: browserTab.url || '',
          favIconUrl: browserTab.favIconUrl || '',
          active: true,
          timestamp: storedTabs[browserTab.id].timestamp || Date.now() // Keep original timestamp
        };
      } else {
        // New tab not previously tracked
        storedTabs[browserTab.id] = {
          id: browserTab.id,
          title: browserTab.title || 'Loading...',
          url: browserTab.url || '',
          favIconUrl: browserTab.favIconUrl || '',
          parentId: null, // Can't determine parent for existing tabs
          timestamp: Date.now(),
          active: true
        };
      }
    }

    // Save updated tabs
    await chrome.storage.local.set({ tabs: storedTabs });

    console.log('Synced', browserTabs.length, 'tabs from browser');
  } catch (error) {
    console.error('Error syncing from browser:', error);
    alert('Failed to sync from browser: ' + error.message);
  }
}

// Clear all history
async function clearHistory() {
  if (confirm('Are you sure you want to clear all tab history? This cannot be undone.')) {
    await chrome.storage.local.set({
      tabs: {},
      canvasData: { positions: {}, groups: {}, comments: {} }
    });
    window.location.reload();
  }
}

// Save tabs data to storage (with update flag to prevent reload loop)
async function saveTabsData(tabsData, isUpdatingStorage) {
  if (isUpdatingStorage) {
    isUpdatingStorage.value = true;
  }

  await chrome.storage.local.set({ tabs: tabsData });

  if (isUpdatingStorage) {
    setTimeout(() => {
      isUpdatingStorage.value = false;
    }, 100);
  }
}

// Save canvas data to storage (with update flag to prevent reload loop)
async function saveCanvasData(canvasData, isUpdatingStorage) {
  if (isUpdatingStorage) {
    isUpdatingStorage.value = true;
  }

  await chrome.storage.local.set({ canvasData });

  if (isUpdatingStorage) {
    setTimeout(() => {
      isUpdatingStorage.value = false;
    }, 100);
  }
}

// Load all data from storage
async function loadAllData() {
  const { tabs = {}, canvasData: savedCanvasData = null, darkMode: savedDarkMode = false } =
    await chrome.storage.local.get(['tabs', 'canvasData', 'darkMode']);

  // Ensure canvas data has all required fields
  const canvasData = savedCanvasData || { positions: {}, groups: {}, comments: {} };
  if (!canvasData.comments) {
    canvasData.comments = {};
  }
  if (!canvasData.positions) {
    canvasData.positions = {};
  }
  if (!canvasData.groups) {
    canvasData.groups = {};
  }

  return {
    tabs,
    canvasData,
    darkMode: savedDarkMode
  };
}
