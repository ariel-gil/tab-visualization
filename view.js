// View.js - Main application controller and UI orchestration

let tabsData = {}; // Will store all tabs from chrome.storage
let searchTerm = ''; // Current search filter
let showClosedTabs = true; // Toggle for showing closed tabs
let currentActiveTabId = null; // ID of the currently active tab
let collapsedNodes = new Set(); // Track which nodes are collapsed
let viewMode = 'tree'; // 'tree', 'sequential', or 'canvas'
let sortOrder = 'newest'; // 'newest' or 'oldest'
let isUpdatingStorage = false; // Flag to prevent storage listener from reloading when we update

// Tree view selection mode
let selectionMode = false; // Whether multi-select mode is active
let selectedTabs = new Set(); // Set of selected tab IDs

// Dark mode
let darkMode = false; // Whether dark mode is enabled

// Canvas view data
let canvasData = {
  positions: {}, // { tabId: { x, y } }
  groups: {}, // { groupId: { id, name, color, tabs: [tabId], position: { x, y, width, height } } }
  comments: {}, // { commentId: { id, text, position: { x, y }, timestamp } }
};
let gridSnapEnabled = true; // Whether to snap to grid
let gridSize = 20; // Grid size in pixels
let draggedElement = null; // Currently dragged element
let dragOffset = { x: 0, y: 0 }; // Offset from mouse to element top-left
let draggedType = null; // 'tab' or 'group'
let draggedId = null; // ID of dragged element
let originalPosition = null; // Original position before dragging (for collision revert)
let dropTargetGroup = null; // Group that tab is being dragged over
let dropTargetTab = null; // Tab that another tab is being dragged over (for parent-child)

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  document.getElementById('showClosedToggle').addEventListener('change', handleClosedToggle);
  document.getElementById('treeViewBtn').addEventListener('click', () => switchViewMode('tree'));
  document.getElementById('sequentialViewBtn').addEventListener('click', () => switchViewMode('sequential'));
  document.getElementById('canvasViewBtn').addEventListener('click', () => switchViewMode('canvas'));
  document.getElementById('sortOrderSelect').addEventListener('change', handleSortChange);
  document.getElementById('gridSnapToggle').addEventListener('change', handleGridSnapToggle);
  document.getElementById('selectionModeBtn').addEventListener('click', toggleSelectionMode);
  document.getElementById('darkModeBtn').addEventListener('click', toggleDarkMode);
  document.getElementById('createGroupBtn').addEventListener('click', createNewGroup);
  document.getElementById('autoGroupBtn').addEventListener('click', autoGroupByDomain);
  document.getElementById('clearAutoGroupsBtn').addEventListener('click', clearAutoGroups);
  document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
  document.getElementById('fullscreenMinimizerDot').addEventListener('click', showFullscreenControls);
  document.getElementById('fullscreenControlsClose').addEventListener('click', hideFullscreenControls);
  document.getElementById('refreshBtn').addEventListener('click', loadAndRender);
  document.getElementById('syncFromBrowserBtn').addEventListener('click', syncFromBrowser);
  document.getElementById('saveSessionBtn').addEventListener('click', saveSession);
  document.getElementById('loadSessionBtn').addEventListener('click', () => {
    document.getElementById('sessionFileInput').click();
  });
  document.getElementById('sessionFileInput').addEventListener('change', loadSession);
  document.getElementById('clearBtn').addEventListener('click', clearHistory);

  // Load and display tabs
  loadAndRender();

  // Listen for storage changes to update in real-time
  // This will fire when background.js updates tabs (new tab, tab closed, etc.)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.tabs && !isUpdatingStorage) {
      console.log('Storage changed by background.js, reloading...');
      loadAndRender();
    }
  });

  // Get current active tab
  getCurrentActiveTab();
});

// Get the currently active tab in the current window
async function getCurrentActiveTab() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      currentActiveTabId = activeTab.id;
      render(); // Re-render to highlight current tab
    }
  } catch (error) {
    console.error('Failed to get current active tab:', error);
  }
}

// Load tab data from storage and render the view
async function loadAndRender() {
  const { tabs = {}, canvasData: savedCanvasData = null, darkMode: savedDarkMode = false } = await chrome.storage.local.get(['tabs', 'canvasData', 'darkMode']);
  tabsData = tabs;

  // Load canvas data if available
  if (savedCanvasData) {
    canvasData = savedCanvasData;
    // Ensure comments object exists (backwards compatibility)
    if (!canvasData.comments) {
      canvasData.comments = {};
    }
  }

  // Load dark mode preference
  darkMode = savedDarkMode;
  if (darkMode) {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeBtn').textContent = '☀️';
  }

  await getCurrentActiveTab();
  render();
  updateStats();
}

// Handle search input
function handleSearch(event) {
  searchTerm = event.target.value.toLowerCase();
  render();
}

// Handle closed tabs toggle
function handleClosedToggle(event) {
  showClosedTabs = event.target.checked;
  render();
}

// Switch view mode
function switchViewMode(mode) {
  viewMode = mode;

  // Update active button
  document.getElementById('treeViewBtn').classList.toggle('active', mode === 'tree');
  document.getElementById('sequentialViewBtn').classList.toggle('active', mode === 'sequential');
  document.getElementById('canvasViewBtn').classList.toggle('active', mode === 'canvas');

  // Show/hide sort order dropdown
  const sortSelect = document.getElementById('sortOrderSelect');
  sortSelect.style.display = mode === 'sequential' ? 'block' : 'none';

  // Show/hide canvas-specific controls
  const gridSnapLabel = document.getElementById('gridSnapToggleLabel');
  const createGroupBtn = document.getElementById('createGroupBtn');
  const autoGroupBtn = document.getElementById('autoGroupBtn');
  const clearAutoGroupsBtn = document.getElementById('clearAutoGroupsBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  gridSnapLabel.style.display = mode === 'canvas' ? 'flex' : 'none';
  createGroupBtn.style.display = mode === 'canvas' ? 'block' : 'none';
  autoGroupBtn.style.display = mode === 'canvas' ? 'block' : 'none';
  clearAutoGroupsBtn.style.display = mode === 'canvas' ? 'block' : 'none';
  fullscreenBtn.style.display = mode === 'canvas' ? 'block' : 'none';

  // Show/hide tree-specific controls
  const selectionModeBtn = document.getElementById('selectionModeBtn');
  selectionModeBtn.style.display = mode === 'tree' ? 'block' : 'none';

  // Reset selection mode when switching views
  if (mode !== 'tree' && selectionMode) {
    selectionMode = false;
    selectedTabs.clear();
    selectionModeBtn.classList.remove('active');
    selectionModeBtn.textContent = 'Multi-Select Mode';
  }

  render();
}

// Handle sort order change
function handleSortChange(event) {
  sortOrder = event.target.value;
  render();
}

// Handle grid snap toggle
function handleGridSnapToggle(event) {
  gridSnapEnabled = event.target.checked;
}

// Toggle dark mode
async function toggleDarkMode() {
  darkMode = !darkMode;
  const btn = document.getElementById('darkModeBtn');

  if (darkMode) {
    document.body.classList.add('dark-mode');
    btn.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    btn.textContent = '🌙';
  }

  // Save preference to storage
  await chrome.storage.local.set({ darkMode });
}

// Toggle fullscreen mode
function toggleFullscreen() {
  const container = document.querySelector('.container');

  if (!document.fullscreenElement) {
    // Enter fullscreen
    container.requestFullscreen().then(() => {
      container.classList.add('fullscreen-mode');
      document.getElementById('fullscreenBtn').textContent = '⛶ Exit Fullscreen';
      populateFullscreenControls();
    }).catch((err) => {
      console.error('Failed to enter fullscreen:', err);
    });
  } else {
    // Exit fullscreen
    document.exitFullscreen().then(() => {
      container.classList.remove('fullscreen-mode');
      document.getElementById('fullscreenBtn').textContent = '⛶ Fullscreen';
    });
  }
}

// Populate fullscreen controls panel with cloned controls
function populateFullscreenControls() {
  const controlsContent = document.getElementById('fullscreenControlsContent');
  const originalControls = document.querySelector('.controls .button-group');

  // Clear existing content
  controlsContent.innerHTML = '';

  // Clone all buttons and controls
  const buttons = originalControls.querySelectorAll('button, label');
  buttons.forEach(element => {
    const clone = element.cloneNode(true);

    // Re-attach event listeners to cloned elements
    if (element.id) {
      const originalElement = document.getElementById(element.id);
      clone.addEventListener('click', () => {
        originalElement.click();
        // Close the panel after clicking a button (except for toggles)
        if (!clone.classList.contains('toggle-label')) {
          hideFullscreenControls();
        }
      });

      // For checkboxes in labels, sync the state
      if (clone.querySelector('input[type="checkbox"]')) {
        const clonedCheckbox = clone.querySelector('input[type="checkbox"]');
        const originalCheckbox = originalElement.querySelector('input[type="checkbox"]');
        clonedCheckbox.addEventListener('change', () => {
          originalCheckbox.checked = clonedCheckbox.checked;
          originalCheckbox.dispatchEvent(new Event('change'));
        });
      }
    }

    controlsContent.appendChild(clone);
  });
}

// Show fullscreen controls panel
function showFullscreenControls() {
  const panel = document.getElementById('fullscreenControlsPanel');
  panel.classList.add('visible');
}

// Hide fullscreen controls panel
function hideFullscreenControls() {
  const panel = document.getElementById('fullscreenControlsPanel');
  panel.classList.remove('visible');
}

// Listen for fullscreen changes (ESC key)
document.addEventListener('fullscreenchange', () => {
  const container = document.querySelector('.container');
  const btn = document.getElementById('fullscreenBtn');

  if (!document.fullscreenElement) {
    container.classList.remove('fullscreen-mode');
    if (btn) btn.textContent = '⛶ Fullscreen';
    hideFullscreenControls();
  }
});

// Toggle selection mode in tree view
function toggleSelectionMode() {
  selectionMode = !selectionMode;
  const btn = document.getElementById('selectionModeBtn');

  if (selectionMode) {
    btn.classList.add('active');
    btn.textContent = 'Exit Selection Mode';
  } else {
    btn.classList.remove('active');
    btn.textContent = 'Multi-Select Mode';
    selectedTabs.clear();
  }

  render();
}

// Handle tab selection (checkbox click)
function handleTabSelection(tabId, event) {
  event.stopPropagation();

  if (selectedTabs.has(tabId)) {
    selectedTabs.delete(tabId);
  } else {
    selectedTabs.add(tabId);
  }

  render();
}

// Main render function - delegates to tree, sequential, or canvas view
function render() {
  if (viewMode === 'tree') {
    renderTree();
  } else if (viewMode === 'sequential') {
    renderSequential();
  } else if (viewMode === 'canvas') {
    renderCanvas();
  }
}

// Update statistics
function updateStats() {
  const tabsArray = Object.values(tabsData);
  const activeTabs = tabsArray.filter(t => t.active).length;
  const closedTabs = tabsArray.filter(t => !t.active).length;

  document.getElementById('totalTabs').textContent = `Total tabs: ${tabsArray.length}`;
  document.getElementById('activeTabs').textContent = `Active: ${activeTabs}`;
  document.getElementById('closedTabs').textContent = `Closed: ${closedTabs}`;
}

// NOTE: The following functions have been moved to separate modules:
// - Tree view functions → tree-view.js
// - Sequential view functions → sequential-view.js
// - Canvas view functions → canvas-view.js
// - Relationship management → relationship-manager.js
// - Storage management → storage-manager.js
// - Group management → group-manager.js
// - Comment management → comment-manager.js
// - Popup utilities → popup-utils.js
// - General utilities → utils.js
