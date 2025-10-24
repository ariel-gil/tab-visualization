// View.js - Handles the visualization of tab relationships

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

// Make selected tabs children of target tab
// Make a single tab a child of another tab (for canvas drag-drop)
async function makeTabChild(childId, parentId) {
  // Don't allow a tab to be its own parent
  if (childId === parentId) {
    alert('Cannot make a tab its own child!');
    return false;
  }

  // Check for circular relationships (parent becoming child of its descendant)
  const descendants = new Set();
  const collectDescendants = (tabId) => {
    if (!tabsData[tabId]) return;
    Object.values(tabsData).forEach(tab => {
      if (tab.parentId === tabId) {
        descendants.add(tab.id);
        collectDescendants(tab.id);
      }
    });
  };
  collectDescendants(parentId);

  if (descendants.has(childId)) {
    alert('Cannot create circular parent-child relationships!');
    return false;
  }

  // Update parent relationship
  if (tabsData[childId]) {
    tabsData[childId].parentId = parentId;
  }

  // Save to storage
  await chrome.storage.local.set({ tabs: tabsData });

  return true;
}

async function makeTabsChildren(parentId) {
  if (selectedTabs.size === 0) return;

  // Don't allow a tab to be its own parent
  if (selectedTabs.has(parentId)) {
    alert('Cannot make a tab its own child!');
    return;
  }

  // Check for circular relationships (parent becoming child of its descendant)
  const descendants = new Set();
  const collectDescendants = (tabId) => {
    if (!tabsData[tabId]) return;
    Object.values(tabsData).forEach(tab => {
      if (tab.parentId === tabId) {
        descendants.add(tab.id);
        collectDescendants(tab.id);
      }
    });
  };
  collectDescendants(parentId);

  for (const selectedId of selectedTabs) {
    if (descendants.has(selectedId)) {
      alert('Cannot create circular parent-child relationships!');
      return;
    }
  }

  // Update parent relationships
  selectedTabs.forEach(tabId => {
    if (tabsData[tabId]) {
      tabsData[tabId].parentId = parentId;
    }
  });

  // Save to storage
  await chrome.storage.local.set({ tabs: tabsData });

  // Clear selection and exit selection mode
  selectedTabs.clear();
  selectionMode = false;
  const btn = document.getElementById('selectionModeBtn');
  btn.classList.remove('active');
  btn.textContent = 'Multi-Select Mode';

  // Reload and render
  await loadAndRender();
}

// Tree drag-and-drop handlers
function handleTreeDragStart(e, tabId) {
  if (selectedTabs.size === 0) {
    e.preventDefault();
    return;
  }

  e.stopPropagation();
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', tabId);

  // Visual feedback
  e.target.style.opacity = '0.5';
}

function handleTreeDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';

  // Add visual feedback to drop target
  const node = e.currentTarget;
  if (!node.classList.contains('drag-over')) {
    node.classList.add('drag-over');
  }
}

function handleTreeDragLeave(e) {
  e.stopPropagation();
  const node = e.currentTarget;
  node.classList.remove('drag-over');
}

async function handleTreeDrop(e, targetTabId) {
  e.preventDefault();
  e.stopPropagation();

  // Remove visual feedback
  const node = e.currentTarget;
  node.classList.remove('drag-over');

  // Reset opacity of dragged elements
  document.querySelectorAll('.tree-node').forEach(n => n.style.opacity = '1');

  // Make selected tabs children of target
  await makeTabsChildren(targetTabId);
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

// Build tree structure from flat tab data
function buildTree() {
  // Convert tabs object to array
  const tabsArray = Object.values(tabsData);

  // Filter by closed tabs toggle
  let filteredTabs = tabsArray;
  if (!showClosedTabs) {
    filteredTabs = filteredTabs.filter(tab => tab.active);
  }

  // Filter by search term if present
  if (searchTerm) {
    filteredTabs = filteredTabs.filter(tab => {
      return (
        tab.title.toLowerCase().includes(searchTerm) ||
        tab.url.toLowerCase().includes(searchTerm)
      );
    });
  }

  // Find root tabs (tabs with no parent or parent doesn't exist)
  const rootTabs = filteredTabs.filter(tab => {
    return !tab.parentId || !tabsData[tab.parentId];
  });

  // Build tree recursively
  return rootTabs.map(tab => buildNode(tab, filteredTabs));
}

// Build a single node with its children
function buildNode(tab, allTabs) {
  const children = allTabs.filter(t => t.parentId === tab.id);
  return {
    ...tab,
    children: children.map(child => buildNode(child, allTabs))
  };
}

// Count total descendants (children, grandchildren, etc.)
function countDescendants(node) {
  if (!node.children || node.children.length === 0) return 0;
  return node.children.length + node.children.reduce((sum, child) => sum + countDescendants(child), 0);
}

// Render the tree to DOM
function renderTree() {
  const container = document.getElementById('treeContainer');
  const tree = buildTree();

  if (tree.length === 0) {
    container.innerHTML = '<p class="empty-state">No tabs found. Try a different search or open some tabs!</p>';
    return;
  }

  // Clear container and render each root node
  container.innerHTML = '';
  tree.forEach(node => {
    const nodeElement = renderNode(node, true);
    container.appendChild(nodeElement);
  });
}

// Render a single node and its children
function renderNode(node, isRoot = false) {
  const nodeDiv = document.createElement('div');
  const isCurrentTab = node.id === currentActiveTabId && node.active;
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = collapsedNodes.has(node.id);
  const isSelected = selectedTabs.has(node.id);

  nodeDiv.className = `tree-node ${node.active ? 'active' : 'inactive'} ${isRoot ? 'root' : ''} ${isCurrentTab ? 'current-active' : ''} ${isCollapsed ? 'collapsed' : ''} ${isSelected ? 'selected' : ''}`;
  nodeDiv.dataset.tabId = node.id;

  // Make node draggable and droppable in selection mode
  if (selectionMode) {
    nodeDiv.draggable = selectedTabs.size > 0;
    nodeDiv.ondragstart = (e) => handleTreeDragStart(e, node.id);
    nodeDiv.ondragover = (e) => handleTreeDragOver(e);
    nodeDiv.ondrop = (e) => handleTreeDrop(e, node.id);
    nodeDiv.ondragleave = (e) => handleTreeDragLeave(e);
  }

  // Format timestamp
  const time = new Date(node.timestamp).toLocaleString();

  // Count children
  const childCount = countDescendants(node);

  // Build node header HTML
  const headerDiv = document.createElement('div');
  headerDiv.className = 'node-header';

  // Add checkbox in selection mode
  if (selectionMode) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'node-checkbox';
    checkbox.checked = isSelected;
    checkbox.onclick = (e) => handleTabSelection(node.id, e);
    headerDiv.appendChild(checkbox);
  }

  // Collapse/expand icon (if has children)
  if (hasChildren) {
    const collapseIcon = document.createElement('div');
    collapseIcon.className = 'node-collapse-icon';
    collapseIcon.textContent = isCollapsed ? '▶' : '▼';
    collapseIcon.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleCollapse(node.id);
    });
    headerDiv.appendChild(collapseIcon);
  } else {
    // Empty space for alignment
    const spacer = document.createElement('div');
    spacer.style.width = '14px';
    headerDiv.appendChild(spacer);
  }

  // Favicon
  if (node.favIconUrl) {
    const favicon = document.createElement('img');
    favicon.className = 'node-favicon';
    favicon.src = node.favIconUrl;
    favicon.onerror = () => {
      // Hide if favicon fails to load
      favicon.style.display = 'none';
    };
    headerDiv.appendChild(favicon);
  }

  // Title with child count
  const titleDiv = document.createElement('div');
  titleDiv.className = 'node-title';
  titleDiv.textContent = node.title;

  if (childCount > 0) {
    const countSpan = document.createElement('span');
    countSpan.className = 'child-count';
    countSpan.textContent = `(${childCount})`;
    titleDiv.appendChild(countSpan);
  }

  headerDiv.appendChild(titleDiv);

  // Timestamp (more compact format)
  const timeSpan = document.createElement('span');
  timeSpan.className = 'node-time';
  const shortTime = new Date(node.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  timeSpan.textContent = shortTime;
  headerDiv.appendChild(timeSpan);

  // Status badge
  const statusSpan = document.createElement('span');
  statusSpan.className = `node-status ${node.active ? 'active' : 'closed'}`;
  statusSpan.textContent = node.active ? 'Active' : 'Closed';
  headerDiv.appendChild(statusSpan);

  nodeDiv.appendChild(headerDiv);

  // Add click handler for active tabs to jump to them (but not in selection mode)
  if (node.active && !selectionMode) {
    nodeDiv.style.cursor = 'pointer';
    nodeDiv.addEventListener('click', async (event) => {
      // Don't trigger if clicking collapse icon
      if (event.target.classList.contains('node-collapse-icon')) return;

      // Stop propagation to prevent triggering parent node clicks
      event.stopPropagation();

      try {
        // Get the tab to find which window it's in
        const tab = await chrome.tabs.get(node.id);

        // Focus the window first
        await chrome.windows.update(tab.windowId, { focused: true });

        // Then activate the tab
        await chrome.tabs.update(node.id, { active: true });

        // Update current active tab
        currentActiveTabId = node.id;
        renderTree();
      } catch (error) {
        console.error('Failed to switch to tab:', error);
        // Tab might have been closed, reload the view
        loadAndRender();
      }
    });
  }

  // Render children if any
  if (hasChildren) {
    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';

    node.children.forEach(child => {
      const childElement = renderNode(child, false);
      childrenDiv.appendChild(childElement);
    });

    nodeDiv.appendChild(childrenDiv);
  }

  return nodeDiv;
}

// Toggle collapse state for a node
function toggleCollapse(nodeId) {
  if (collapsedNodes.has(nodeId)) {
    collapsedNodes.delete(nodeId);
  } else {
    collapsedNodes.add(nodeId);
  }
  renderTree();
}

// Render sequential (chronological) view
function renderSequential() {
  const container = document.getElementById('treeContainer');

  // Get tabs as array
  let tabsArray = Object.values(tabsData);

  // Filter by closed tabs toggle
  if (!showClosedTabs) {
    tabsArray = tabsArray.filter(tab => tab.active);
  }

  // Filter by search term
  if (searchTerm) {
    tabsArray = tabsArray.filter(tab => {
      return (
        tab.title.toLowerCase().includes(searchTerm) ||
        tab.url.toLowerCase().includes(searchTerm)
      );
    });
  }

  // Sort by timestamp
  tabsArray.sort((a, b) => {
    if (sortOrder === 'newest') {
      return b.timestamp - a.timestamp; // Newest first
    } else {
      return a.timestamp - b.timestamp; // Oldest first
    }
  });

  if (tabsArray.length === 0) {
    container.innerHTML = '<p class="empty-state">No tabs found. Try a different search or open some tabs!</p>';
    return;
  }

  // Clear container
  container.innerHTML = '';

  // Create sequential list container
  const listDiv = document.createElement('div');
  listDiv.className = 'sequential-list';

  // Render each tab
  tabsArray.forEach(tab => {
    const nodeElement = renderSequentialNode(tab);
    listDiv.appendChild(nodeElement);
  });

  container.appendChild(listDiv);
}

// Render a single node in sequential view
function renderSequentialNode(tab) {
  const nodeDiv = document.createElement('div');
  const isCurrentTab = tab.id === currentActiveTabId && tab.active;

  nodeDiv.className = `sequential-node ${tab.active ? 'active' : 'inactive'} ${isCurrentTab ? 'current-active' : ''}`;

  // Format timestamp
  const time = new Date(tab.timestamp).toLocaleString();

  // Build node header HTML
  const headerDiv = document.createElement('div');
  headerDiv.className = 'node-header';

  // Favicon
  if (tab.favIconUrl) {
    const favicon = document.createElement('img');
    favicon.className = 'node-favicon';
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => {
      favicon.style.display = 'none';
    };
    headerDiv.appendChild(favicon);
  }

  // Title
  const titleDiv = document.createElement('div');
  titleDiv.className = 'node-title';
  titleDiv.textContent = tab.title;
  headerDiv.appendChild(titleDiv);

  // Status badge
  const statusSpan = document.createElement('span');
  statusSpan.className = `node-status ${tab.active ? 'active' : 'closed'}`;
  statusSpan.textContent = tab.active ? 'Active' : 'Closed';
  headerDiv.appendChild(statusSpan);

  nodeDiv.appendChild(headerDiv);

  // Meta info
  const metaDiv = document.createElement('div');
  metaDiv.className = 'node-meta';
  metaDiv.textContent = `Last activity: ${time}`;
  nodeDiv.appendChild(metaDiv);

  // Add click handler for active tabs to jump to them
  if (tab.active) {
    nodeDiv.style.cursor = 'pointer';
    nodeDiv.addEventListener('click', async (event) => {
      event.stopPropagation();

      try {
        const tabInfo = await chrome.tabs.get(tab.id);
        await chrome.windows.update(tabInfo.windowId, { focused: true });
        await chrome.tabs.update(tab.id, { active: true });

        currentActiveTabId = tab.id;
        render();
      } catch (error) {
        console.error('Failed to switch to tab:', error);
        loadAndRender();
      }
    });
  }

  return nodeDiv;
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

// Save session to file (includes tabs, canvas layout, and groups)
// saveSession, loadSession, syncFromBrowser, clearHistory moved to storage-manager.js

// ===== CANVAS VIEW FUNCTIONS =====

// Handle grid snap toggle
function handleGridSnapToggle(event) {
  gridSnapEnabled = event.target.checked;
}

// getAllChildren, hasChildren, snapToGrid moved to utils.js

// Group management functions moved to group-manager.js
// createNewGroup, autoGroupByDomain, clearAutoGroups, deleteGroup, addTabToGroup, removeTabFromGroup

// Comment management functions moved to comment-manager.js
// createNewComment, showCommentPopup, deleteComment, showTabCommentPopup, deleteTabComment

// Render canvas view
function renderCanvas() {
  console.log('=== renderCanvas called ===');
  console.log('Tabs with comments:', Object.entries(tabsData)
    .filter(([id, tab]) => tab.comment)
    .map(([id, tab]) => ({ id, title: tab.title, comment: tab.comment }))
  );

  const container = document.getElementById('treeContainer');

  // Save scroll position before clearing
  const existingWorkspace = document.getElementById('canvasWorkspace');
  let savedScrollLeft = 0;
  let savedScrollTop = 0;
  if (existingWorkspace) {
    savedScrollLeft = existingWorkspace.scrollLeft;
    savedScrollTop = existingWorkspace.scrollTop;
  }

  // Get tabs as array - ALWAYS filter out closed tabs in canvas view
  let tabsArray = Object.values(tabsData).filter(tab => tab.active);

  // Filter by search term
  if (searchTerm) {
    tabsArray = tabsArray.filter(tab => {
      return (
        tab.title.toLowerCase().includes(searchTerm) ||
        tab.url.toLowerCase().includes(searchTerm)
      );
    });
  }

  if (tabsArray.length === 0) {
    container.innerHTML = '<p class="empty-state">No tabs found. Try a different search or open some tabs!</p>';
    return;
  }

  // INFINITE CANVAS IMPLEMENTATION
  // Calculate bounding box of all elements to support infinite canvas (including negative coordinates)
  // This allows tabs and groups to be positioned anywhere, even at negative X/Y coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasElements = false;

  // Check tab positions to find the extent of the canvas
  tabsArray.forEach(tab => {
    const pos = canvasData.positions[tab.id];
    if (pos) {
      hasElements = true;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + 230); // tab width
      maxY = Math.max(maxY, pos.y + 100); // approximate tab height
    }
  });

  // Check group positions to find the extent of the canvas
  Object.values(canvasData.groups).forEach(group => {
    if (group.position) {
      hasElements = true;
      minX = Math.min(minX, group.position.x);
      minY = Math.min(minY, group.position.y);
      maxX = Math.max(maxX, group.position.x + group.position.width);
      maxY = Math.max(maxY, group.position.y + group.position.height);
    }
  });

  // Check comment positions to find the extent of the canvas
  Object.values(canvasData.comments || {}).forEach(comment => {
    if (comment.position) {
      hasElements = true;
      minX = Math.min(minX, comment.position.x);
      minY = Math.min(minY, comment.position.y);
      maxX = Math.max(maxX, comment.position.x + 36); // comment icon width
      maxY = Math.max(maxY, comment.position.y + 36); // comment icon height
    }
  });

  // If no elements have positions yet, use default bounds
  if (!hasElements) {
    minX = 0;
    minY = 0;
    maxX = 1200;
    maxY = 800;
  }

  // Add padding around the content so there's always space to drag elements
  const padding = 200;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  // Calculate offset needed to make all coordinates positive for rendering
  // Elements store their position in "canvas coordinates" (can be negative)
  // But CSS positioning requires positive coordinates, so we add an offset
  const offsetX = minX < 0 ? -minX : 0;
  const offsetY = minY < 0 ? -minY : 0;

  // Clear container and set up canvas
  container.innerHTML = '';
  container.className = 'canvas-container';

  // Create canvas workspace
  const canvasWorkspace = document.createElement('div');
  canvasWorkspace.className = 'canvas-workspace';
  canvasWorkspace.id = 'canvasWorkspace';

  // Store offset as data attribute for drag handlers to access
  canvasWorkspace.dataset.offsetX = offsetX;
  canvasWorkspace.dataset.offsetY = offsetY;

  // Set workspace size to encompass all elements
  const workspaceWidth = maxX - minX;
  const workspaceHeight = maxY - minY;
  canvasWorkspace.style.width = workspaceWidth + 'px';
  canvasWorkspace.style.height = workspaceHeight + 'px';

  // Render groups first (so tabs render on top)
  Object.values(canvasData.groups).forEach(group => {
    const groupElement = renderCanvasGroup(group, offsetX, offsetY);
    canvasWorkspace.appendChild(groupElement);
  });

  // Render tabs
  tabsArray.forEach(tab => {
    const tabElement = renderCanvasTab(tab, offsetX, offsetY);
    canvasWorkspace.appendChild(tabElement);
  });

  // Render comments (on top of everything)
  Object.values(canvasData.comments || {}).forEach(comment => {
    const commentElement = renderCanvasComment(comment, offsetX, offsetY);
    canvasWorkspace.appendChild(commentElement);
  });

  container.appendChild(canvasWorkspace);

  // Restore scroll position
  if (savedScrollLeft > 0 || savedScrollTop > 0) {
    canvasWorkspace.scrollLeft = savedScrollLeft;
    canvasWorkspace.scrollTop = savedScrollTop;
  }

  // Set up drag and drop event listeners
  setupCanvasDragAndDrop();
}

// Render a single tab in canvas view
function renderCanvasTab(tab, offsetX = 0, offsetY = 0) {
  const tabDiv = document.createElement('div');
  const isCurrentTab = tab.id === currentActiveTabId && tab.active;

  // Check if tab is in a group
  const groupInfo = Object.values(canvasData.groups).find(g => g.tabs.includes(tab.id));
  const inGroup = !!groupInfo;

  tabDiv.className = `canvas-tab ${tab.active ? 'active' : 'inactive'} ${isCurrentTab ? 'current-active' : ''} ${inGroup ? 'in-group' : ''}`;
  tabDiv.dataset.tabId = tab.id;
  tabDiv.draggable = true;

  // Add visual indicator if in group
  if (inGroup) {
    tabDiv.style.borderColor = groupInfo.color;
  }

  // Get position from saved data or generate default position
  let position = canvasData.positions[tab.id];
  if (!position) {
    // Auto-layout: place in a grid pattern
    const index = Object.keys(tabsData).indexOf(tab.id.toString());
    const cols = 4;
    position = {
      x: 20 + (index % cols) * 250,
      y: 20 + Math.floor(index / cols) * 100
    };
    // Save the position immediately so it's consistent
    canvasData.positions[tab.id] = position;
    saveCanvasData(); // Persist to storage
  }

  // Apply offset to support negative coordinates in infinite canvas
  tabDiv.style.left = (position.x + offsetX) + 'px';
  tabDiv.style.top = (position.y + offsetY) + 'px';

  // Build tab content
  const headerDiv = document.createElement('div');
  headerDiv.className = 'canvas-tab-header';

  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'canvas-tab-drag-handle';
  dragHandle.textContent = '⋮⋮';
  headerDiv.appendChild(dragHandle);

  // Children indicator if tab has children
  const tabHasChildren = hasChildren(tab.id);
  if (tabHasChildren) {
    const childrenDot = document.createElement('div');
    childrenDot.className = 'canvas-tab-children-dot';
    childrenDot.classList.add('expandable');

    const childCount = getAllChildren(tab.id).size;
    childrenDot.textContent = '●';
    childrenDot.title = `Has ${childCount} child tab(s). Click to view.`;

    childrenDot.addEventListener('click', (e) => {
      e.stopPropagation();
      showChildrenPopup(tab.id, e.clientX, e.clientY);
    });

    headerDiv.appendChild(childrenDot);
  }

  // Favicon
  if (tab.favIconUrl) {
    const favicon = document.createElement('img');
    favicon.className = 'node-favicon';
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => { favicon.style.display = 'none'; };
    headerDiv.appendChild(favicon);
  }

  // Title
  const titleDiv = document.createElement('div');
  titleDiv.className = 'canvas-tab-title';
  titleDiv.textContent = tab.title;
  headerDiv.appendChild(titleDiv);

  tabDiv.appendChild(headerDiv);

  // Comment indicator if tab has a comment
  console.log('Checking comment for tab', tab.id, ':', tab.comment);
  if (tab.comment && tab.comment.trim()) {
    console.log('✓ Creating comment indicator for tab', tab.id);
    const commentIndicator = document.createElement('div');
    commentIndicator.className = 'canvas-tab-comment-indicator';
    commentIndicator.textContent = '💬';
    commentIndicator.title = 'Click to view/edit comment';
    commentIndicator.style.cursor = 'pointer';

    // Click handler to show comment popup
    commentIndicator.onclick = (e) => {
      e.stopPropagation(); // Prevent tab click
      showTabCommentPopup(tab.id);
    };

    tabDiv.appendChild(commentIndicator);
    console.log('Comment indicator appended to tabDiv with click handler');
  } else {
    console.log('✗ No comment indicator - comment:', tab.comment);
  }

  // Context menu button
  const menuBtn = document.createElement('button');
  menuBtn.className = 'canvas-tab-menu-btn';
  menuBtn.textContent = '⋯';
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    showTabContextMenu(tab.id, e.clientX, e.clientY);
  };
  tabDiv.appendChild(menuBtn);

  // Click to activate tab
  if (tab.active) {
    tabDiv.style.cursor = 'pointer';
    tabDiv.addEventListener('click', async (event) => {
      if (event.target === dragHandle || event.target === menuBtn) return;
      event.stopPropagation();

      try {
        const tabInfo = await chrome.tabs.get(tab.id);
        await chrome.windows.update(tabInfo.windowId, { focused: true });
        await chrome.tabs.update(tab.id, { active: true });
        currentActiveTabId = tab.id;
        render();
      } catch (error) {
        console.error('Failed to switch to tab:', error);
        loadAndRender();
      }
    });
  }

  return tabDiv;
}

// Render a group in canvas view
function renderCanvasGroup(group, offsetX = 0, offsetY = 0) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'canvas-group';
  groupDiv.dataset.groupId = group.id;
  groupDiv.draggable = true;

  const pos = group.position;
  // Apply offset to support negative coordinates in infinite canvas
  groupDiv.style.left = (pos.x + offsetX) + 'px';
  groupDiv.style.top = (pos.y + offsetY) + 'px';
  groupDiv.style.width = pos.width + 'px';
  groupDiv.style.height = pos.height + 'px';
  groupDiv.style.borderColor = group.color;
  groupDiv.style.backgroundColor = group.color + '20'; // Add transparency

  // Group header
  const headerDiv = document.createElement('div');
  headerDiv.className = 'canvas-group-header';
  headerDiv.style.backgroundColor = group.color;

  // Group name
  const nameSpan = document.createElement('span');
  nameSpan.className = 'canvas-group-name';
  nameSpan.textContent = group.name;
  headerDiv.appendChild(nameSpan);

  // Tab count (only active tabs)
  const activeTabCount = group.tabs.filter(id => tabsData[id] && tabsData[id].active).length;
  const countSpan = document.createElement('span');
  countSpan.className = 'canvas-group-count';
  countSpan.textContent = `(${activeTabCount})`;
  headerDiv.appendChild(countSpan);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'canvas-group-delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteGroup(group.id);
  };
  headerDiv.appendChild(deleteBtn);

  groupDiv.appendChild(headerDiv);

  // Resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'canvas-group-resize-handle';
  resizeHandle.textContent = '⇲';
  groupDiv.appendChild(resizeHandle);

  return groupDiv;
}

// Render a comment in canvas view
function renderCanvasComment(comment, offsetX = 0, offsetY = 0) {
  const commentDiv = document.createElement('div');
  commentDiv.className = 'canvas-comment';
  commentDiv.dataset.commentId = comment.id;
  commentDiv.draggable = true;

  // Apply offset to support negative coordinates in infinite canvas
  commentDiv.style.left = (comment.position.x + offsetX) + 'px';
  commentDiv.style.top = (comment.position.y + offsetY) + 'px';

  // Comment icon
  commentDiv.textContent = '💬';
  commentDiv.title = comment.text ? comment.text.substring(0, 50) + (comment.text.length > 50 ? '...' : '') : 'Click to add comment';

  // Click to show/edit comment
  commentDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    showCommentPopup(comment.id, false);
  });

  return commentDiv;
}

// Show children popup in canvas view
// Popup utility functions moved to popup-utils.js
// showChildrenPopup, showTabContextMenu

// checkCollision moved to utils.js

// Check if a point/rectangle is inside a group
function isInsideGroup(x, y, width, height, groupId) {
  const group = canvasData.groups[groupId];
  if (!group) return false;

  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return (
    centerX >= group.position.x &&
    centerX <= group.position.x + group.position.width &&
    centerY >= group.position.y &&
    centerY <= group.position.y + group.position.height
  );
}

// Push away overlapping elements to make room for a new position
function pushAwayOverlaps(type, id, newX, newY, newWidth, newHeight, depth = 0) {
  // Limit recursion depth to prevent infinite loops and excessive pushing
  if (depth > 3) return;

  const newRect = { x: newX, y: newY, width: newWidth, height: newHeight };
  const tabWidth = 230;
  const tabHeight = 60;

  if (type === 'tab') {
    newRect.width = tabWidth;
    newRect.height = tabHeight;

    // Get which group this tab belongs to (if any)
    const tabIdNum = parseInt(id);
    const ownGroup = Object.values(canvasData.groups).find(g => g.tabs.includes(tabIdNum));

    // Check collision with other tabs (except those in same group)
    for (const [otherId, pos] of Object.entries(canvasData.positions)) {
      if (otherId == id) continue;

      const otherIdNum = parseInt(otherId);
      const otherGroup = Object.values(canvasData.groups).find(g => g.tabs.includes(otherIdNum));

      // Skip if both tabs are in the same group
      if (ownGroup && otherGroup && ownGroup.id === otherGroup.id) continue;

      const otherRect = { x: pos.x, y: pos.y, width: tabWidth, height: tabHeight };
      if (checkCollision(newRect, otherRect)) {
        // Calculate overlap amount to push by minimal distance
        const pushDirection = getPushDirection(newRect, otherRect);

        let pushDistance;
        if (pushDirection === 'right' || pushDirection === 'left') {
          // Calculate exact overlap in X direction
          const overlapX = (newRect.x + newRect.width) - otherRect.x;
          pushDistance = Math.max(overlapX + 20, 50); // At least 50px, or overlap + margin
        } else {
          // Calculate exact overlap in Y direction
          const overlapY = (newRect.y + newRect.height) - otherRect.y;
          pushDistance = Math.max(overlapY + 20, 50);
        }

        if (pushDirection === 'right') {
          pos.x += pushDistance;
        } else if (pushDirection === 'left') {
          pos.x -= pushDistance;
        } else if (pushDirection === 'down') {
          pos.y += pushDistance;
        } else if (pushDirection === 'up') {
          pos.y -= pushDistance;
        }

        // Recursively push anything that now overlaps with the moved tab
        pushAwayOverlaps('tab', otherId, pos.x, pos.y, tabWidth, tabHeight, depth + 1);
      }
    }

    // Check collision with groups (except the one we might be dropping into)
    for (const [groupId, group] of Object.entries(canvasData.groups)) {
      // If tab is being dropped into this group, allow the overlap
      if (isInsideGroup(newX, newY, tabWidth, tabHeight, groupId)) {
        continue;
      }

      const groupRect = {
        x: group.position.x,
        y: group.position.y,
        width: group.position.width,
        height: group.position.height
      };
      if (checkCollision(newRect, groupRect)) {
        // Calculate minimal push distance
        const pushDirection = getPushDirection(newRect, groupRect);
        let pushDistance;

        if (pushDirection === 'right' || pushDirection === 'left') {
          const overlapX = (newRect.x + newRect.width) - groupRect.x;
          pushDistance = Math.max(overlapX + 30, 100);
        } else {
          const overlapY = (newRect.y + newRect.height) - groupRect.y;
          pushDistance = Math.max(overlapY + 30, 100);
        }

        const deltaX = pushDirection === 'right' ? pushDistance :
                       pushDirection === 'left' ? -pushDistance : 0;
        const deltaY = pushDirection === 'down' ? pushDistance :
                       pushDirection === 'up' ? -pushDistance : 0;

        group.position.x += deltaX;
        group.position.y += deltaY;

        // Move all tabs in the group
        group.tabs.forEach(tabId => {
          if (canvasData.positions[tabId]) {
            canvasData.positions[tabId].x += deltaX;
            canvasData.positions[tabId].y += deltaY;
          }
        });
      }
    }
  } else if (type === 'group') {
    // Check collision with other groups
    for (const [otherId, otherGroup] of Object.entries(canvasData.groups)) {
      if (otherId === id) continue;

      const otherRect = {
        x: otherGroup.position.x,
        y: otherGroup.position.y,
        width: otherGroup.position.width,
        height: otherGroup.position.height
      };
      if (checkCollision(newRect, otherRect)) {
        // Calculate minimal push distance
        const pushDirection = getPushDirection(newRect, otherRect);
        let pushDistance;

        if (pushDirection === 'right' || pushDirection === 'left') {
          const overlapX = (newRect.x + newRect.width) - otherRect.x;
          pushDistance = Math.max(overlapX + 30, 100);
        } else {
          const overlapY = (newRect.y + newRect.height) - otherRect.y;
          pushDistance = Math.max(overlapY + 30, 100);
        }

        const deltaX = pushDirection === 'right' ? pushDistance :
                       pushDirection === 'left' ? -pushDistance : 0;
        const deltaY = pushDirection === 'down' ? pushDistance :
                       pushDirection === 'up' ? -pushDistance : 0;

        otherGroup.position.x += deltaX;
        otherGroup.position.y += deltaY;

        // Move all tabs in the pushed group
        otherGroup.tabs.forEach(tabId => {
          if (canvasData.positions[tabId]) {
            canvasData.positions[tabId].x += deltaX;
            canvasData.positions[tabId].y += deltaY;
          }
        });
      }
    }

    // Check collision with tabs (that are NOT in this group)
    const group = canvasData.groups[id];
    const tabsInGroup = group ? group.tabs : [];

    for (const [tabId, pos] of Object.entries(canvasData.positions)) {
      const tabIdNum = parseInt(tabId);

      // Skip tabs that are inside this group
      if (tabsInGroup.includes(tabIdNum)) continue;

      const tabRect = { x: pos.x, y: pos.y, width: tabWidth, height: tabHeight };
      if (checkCollision(newRect, tabRect)) {
        // Calculate minimal push distance
        const pushDirection = getPushDirection(newRect, tabRect);
        let pushDistance;

        if (pushDirection === 'right' || pushDirection === 'left') {
          const overlapX = (newRect.x + newRect.width) - tabRect.x;
          pushDistance = Math.max(overlapX + 20, 50);
        } else {
          const overlapY = (newRect.y + newRect.height) - tabRect.y;
          pushDistance = Math.max(overlapY + 20, 50);
        }

        if (pushDirection === 'right') {
          pos.x += pushDistance;
        } else if (pushDirection === 'left') {
          pos.x -= pushDistance;
        } else if (pushDirection === 'down') {
          pos.y += pushDistance;
        } else if (pushDirection === 'up') {
          pos.y -= pushDistance;
        }

        // Recursively push anything that now overlaps
        pushAwayOverlaps('tab', tabId, pos.x, pos.y, tabWidth, tabHeight, depth + 1);
      }
    }
  }
}

// Determine which direction to push an overlapping element
function getPushDirection(newRect, otherRect) {
  // Calculate the center points
  const newCenterX = newRect.x + newRect.width / 2;
  const newCenterY = newRect.y + newRect.height / 2;
  const otherCenterX = otherRect.x + otherRect.width / 2;
  const otherCenterY = otherRect.y + otherRect.height / 2;

  // Calculate the difference
  const dx = otherCenterX - newCenterX;
  const dy = otherCenterY - newCenterY;

  // Push in the direction with the largest difference
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

// Check if a new position would cause a collision (used for initial group placement)
function wouldCollide(type, id, newX, newY, newWidth, newHeight) {
  const newRect = { x: newX, y: newY, width: newWidth, height: newHeight };

  if (type === 'tab') {
    const tabWidth = 230;
    const tabHeight = 60;
    newRect.width = tabWidth;
    newRect.height = tabHeight;

    // Get which group this tab belongs to (if any)
    const tabIdNum = parseInt(id);
    const ownGroup = Object.values(canvasData.groups).find(g => g.tabs.includes(tabIdNum));

    // Check collision with other tabs (except those in same group)
    for (const [otherId, pos] of Object.entries(canvasData.positions)) {
      if (otherId == id) continue; // Use == for string/number comparison

      const otherIdNum = parseInt(otherId);
      const otherGroup = Object.values(canvasData.groups).find(g => g.tabs.includes(otherIdNum));

      // Skip collision check if both tabs are in the same group
      if (ownGroup && otherGroup && ownGroup.id === otherGroup.id) continue;

      const otherRect = { x: pos.x, y: pos.y, width: tabWidth, height: tabHeight };
      if (checkCollision(newRect, otherRect)) {
        return true;
      }
    }

    // Check collision with groups (except the one we might be dropping into)
    for (const [groupId, group] of Object.entries(canvasData.groups)) {
      // If tab is being dropped into this group, allow the overlap
      if (isInsideGroup(newX, newY, tabWidth, tabHeight, groupId)) {
        continue;
      }

      const groupRect = {
        x: group.position.x,
        y: group.position.y,
        width: group.position.width,
        height: group.position.height
      };
      if (checkCollision(newRect, groupRect)) {
        return true;
      }
    }
  } else if (type === 'group') {
    // Check collision with other groups
    for (const [otherId, otherGroup] of Object.entries(canvasData.groups)) {
      if (otherId === id) continue;

      const otherRect = {
        x: otherGroup.position.x,
        y: otherGroup.position.y,
        width: otherGroup.position.width,
        height: otherGroup.position.height
      };
      if (checkCollision(newRect, otherRect)) {
        return true;
      }
    }

    // Check collision with tabs (that are NOT in this group)
    const group = canvasData.groups[id];
    const tabsInGroup = group ? group.tabs : [];
    const tabWidth = 230;
    const tabHeight = 60;

    for (const [tabId, pos] of Object.entries(canvasData.positions)) {
      const tabIdNum = parseInt(tabId);

      // Skip tabs that are inside this group
      if (tabsInGroup.includes(tabIdNum)) continue;

      const tabRect = { x: pos.x, y: pos.y, width: tabWidth, height: tabHeight };
      if (checkCollision(newRect, tabRect)) {
        return true;
      }
    }
  }

  return false;
}

// Set up drag and drop for canvas
function setupCanvasDragAndDrop() {
  const workspace = document.getElementById('canvasWorkspace');

  // Drag start
  workspace.addEventListener('dragstart', (e) => {
    const target = e.target;

    if (target.classList.contains('canvas-tab')) {
      draggedType = 'tab';
      draggedId = target.dataset.tabId;
      draggedElement = target;

      // Save original position
      originalPosition = { ...canvasData.positions[draggedId] };

      const rect = target.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      target.style.opacity = '0.5';
    } else if (target.classList.contains('canvas-group')) {
      draggedType = 'group';
      draggedId = target.dataset.groupId;
      draggedElement = target;

      // Save original position
      originalPosition = { ...canvasData.groups[draggedId].position };

      const rect = target.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      target.style.opacity = '0.5';
    } else if (target.classList.contains('canvas-comment')) {
      draggedType = 'comment';
      draggedId = target.dataset.commentId;
      draggedElement = target;

      // Save original position
      originalPosition = { ...canvasData.comments[draggedId].position };

      const rect = target.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      target.style.opacity = '0.5';
    }
  });

  // Drag over
  workspace.addEventListener('dragover', (e) => {
    e.preventDefault();

    // Highlight group or tab when dragging tab over it
    if (draggedType === 'tab') {
      const workspaceRect = workspace.getBoundingClientRect();
      const mouseX = e.clientX - workspaceRect.left + workspace.scrollLeft;
      const mouseY = e.clientY - workspaceRect.top + workspace.scrollTop;

      // Get offset from workspace dataset
      const offsetX = parseFloat(workspace.dataset.offsetX) || 0;
      const offsetY = parseFloat(workspace.dataset.offsetY) || 0;

      // Convert mouse position to canvas coordinates (subtract offset)
      const canvasMouseX = mouseX - offsetX;
      const canvasMouseY = mouseY - offsetY;

      // Check which tab (if any) the mouse is over (for parent-child relationship)
      let foundTab = null;
      const tabWidth = 230;
      const tabHeight = 60;
      const draggedTabId = parseInt(draggedId);

      for (const [otherId, pos] of Object.entries(canvasData.positions)) {
        const otherTabId = parseInt(otherId);
        if (otherTabId === draggedTabId) continue;
        if (!tabsData[otherTabId] || !tabsData[otherTabId].active) continue;

        if (canvasMouseX >= pos.x &&
            canvasMouseX <= pos.x + tabWidth &&
            canvasMouseY >= pos.y &&
            canvasMouseY <= pos.y + tabHeight) {
          foundTab = otherTabId;
          break;
        }
      }

      // Update tab highlight
      if (foundTab !== dropTargetTab) {
        // Remove highlight from previous tab
        if (dropTargetTab) {
          const prevTabEl = workspace.querySelector(`[data-tab-id="${dropTargetTab}"]`);
          if (prevTabEl) prevTabEl.classList.remove('drop-target-parent');
        }

        // Add highlight to new tab
        if (foundTab) {
          const tabEl = workspace.querySelector(`[data-tab-id="${foundTab}"]`);
          if (tabEl) tabEl.classList.add('drop-target-parent');
        }

        dropTargetTab = foundTab;
      }

      // Check which group (if any) the mouse is over (only if not over a tab)
      let foundGroup = null;
      if (!foundTab) {
        for (const [groupId, group] of Object.entries(canvasData.groups)) {
          if (
            canvasMouseX >= group.position.x &&
            canvasMouseX <= group.position.x + group.position.width &&
            canvasMouseY >= group.position.y &&
            canvasMouseY <= group.position.y + group.position.height
          ) {
            foundGroup = groupId;
            break;
          }
        }
      }

      // Update group visual feedback
      if (foundGroup !== dropTargetGroup) {
        // Remove highlight from previous group
        if (dropTargetGroup) {
          const prevGroupEl = workspace.querySelector(`[data-group-id="${dropTargetGroup}"]`);
          if (prevGroupEl) prevGroupEl.classList.remove('drop-target');
        }

        // Add highlight to new group
        if (foundGroup) {
          const groupEl = workspace.querySelector(`[data-group-id="${foundGroup}"]`);
          if (groupEl) groupEl.classList.add('drop-target');
        }

        dropTargetGroup = foundGroup;
      }
    }
  });

  // Drag end
  workspace.addEventListener('dragend', async (e) => {
    if (draggedElement) {
      draggedElement.style.opacity = '1';

      // Remove drop target highlights
      if (dropTargetGroup) {
        const groupEl = workspace.querySelector(`[data-group-id="${dropTargetGroup}"]`);
        if (groupEl) groupEl.classList.remove('drop-target');
      }
      if (dropTargetTab) {
        const tabEl = workspace.querySelector(`[data-tab-id="${dropTargetTab}"]`);
        if (tabEl) tabEl.classList.remove('drop-target-parent');
      }

      const workspaceRect = workspace.getBoundingClientRect();

      // COORDINATE CONVERSION FOR INFINITE CANVAS
      // Step 1: Get mouse position relative to workspace, accounting for scroll
      const newX = e.clientX - workspaceRect.left + workspace.scrollLeft - dragOffset.x;
      const newY = e.clientY - workspaceRect.top + workspace.scrollTop - dragOffset.y;

      // Step 2: Get the offset that was applied to make negative coordinates positive
      const offsetX = parseFloat(workspace.dataset.offsetX) || 0;
      const offsetY = parseFloat(workspace.dataset.offsetY) || 0;

      // Step 3: Convert from screen coordinates to canvas coordinates
      // Subtract offset to get the real position (which may be negative)
      const canvasX = newX - offsetX;
      const canvasY = newY - offsetY;

      // Step 4: Apply grid snapping if enabled
      const snappedX = snapToGrid(canvasX);
      const snappedY = snapToGrid(canvasY);

      if (draggedType === 'tab') {
        const tabWidth = 230;
        const tabHeight = 60;

        // Check if tab was dropped onto another tab to create parent-child relationship
        let droppedOnTab = false;
        const draggedTabId = parseInt(draggedId);

        for (const [otherId, pos] of Object.entries(canvasData.positions)) {
          const otherTabId = parseInt(otherId);
          if (otherTabId === draggedTabId) continue; // Skip self
          if (!tabsData[otherTabId] || !tabsData[otherTabId].active) continue; // Skip closed tabs

          const otherRect = {
            x: pos.x,
            y: pos.y,
            width: tabWidth,
            height: tabHeight
          };

          const draggedRect = {
            x: snappedX,
            y: snappedY,
            width: tabWidth,
            height: tabHeight
          };

          // Check if dropped on this tab (center point overlap)
          const draggedCenterX = snappedX + tabWidth / 2;
          const draggedCenterY = snappedY + tabHeight / 2;

          if (draggedCenterX >= otherRect.x &&
              draggedCenterX <= otherRect.x + otherRect.width &&
              draggedCenterY >= otherRect.y &&
              draggedCenterY <= otherRect.y + otherRect.height) {

            // Make the dragged tab a child of the target tab
            const canMakeChild = await makeTabChild(draggedTabId, otherTabId);
            if (canMakeChild) {
              droppedOnTab = true;
              // Visual feedback: position near parent
              canvasData.positions[draggedId] = {
                x: pos.x + 20,
                y: pos.y + 80
              };
            }
            break;
          }
        }

        if (!droppedOnTab) {
          // Update tab position (store in canvas coordinates, not screen coordinates)
          canvasData.positions[draggedId] = { x: snappedX, y: snappedY };

          // Push away any overlapping elements
          pushAwayOverlaps('tab', draggedId, snappedX, snappedY, tabWidth, tabHeight);

          // Check if tab was dropped into a group
          for (const [groupId, group] of Object.entries(canvasData.groups)) {
            if (isInsideGroup(snappedX, snappedY, tabWidth, tabHeight, groupId)) {
              // Add tab to this group
              addTabToGroup(parseInt(draggedId), groupId);
              break;
            }
          }
        }
      } else if (draggedType === 'group') {
        const group = canvasData.groups[draggedId];

        // Calculate how much the group moved
        const deltaX = snappedX - group.position.x;
        const deltaY = snappedY - group.position.y;

        // Update group position (store in canvas coordinates)
        group.position.x = snappedX;
        group.position.y = snappedY;

        // Move all tabs in the group by the same delta
        group.tabs.forEach(tabId => {
          if (canvasData.positions[tabId]) {
            canvasData.positions[tabId].x += deltaX;
            canvasData.positions[tabId].y += deltaY;
          }
        });

        // Push away any overlapping elements
        pushAwayOverlaps('group', draggedId, snappedX, snappedY, group.position.width, group.position.height);
      } else if (draggedType === 'comment') {
        const comment = canvasData.comments[draggedId];
        const commentWidth = 36;
        const commentHeight = 36;

        // Update comment position (store in canvas coordinates)
        comment.position.x = snappedX;
        comment.position.y = snappedY;

        // Push away any overlapping elements
        pushAwayOverlaps('comment', draggedId, snappedX, snappedY, commentWidth, commentHeight);
      }

      saveCanvasData();
      render();

      draggedElement = null;
      draggedType = null;
      draggedId = null;
      originalPosition = null;
      dropTargetGroup = null;
      dropTargetTab = null;
    }
  });
}

// Save canvas data to storage
async function saveCanvasData() {
  await chrome.storage.local.set({ canvasData });
}

// Utility function escapeHtml moved to utils.js
