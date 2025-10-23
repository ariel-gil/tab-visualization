// View.js - Handles the visualization of tab relationships

let tabsData = {}; // Will store all tabs from chrome.storage
let searchTerm = ''; // Current search filter
let showClosedTabs = true; // Toggle for showing closed tabs
let currentActiveTabId = null; // ID of the currently active tab
let collapsedNodes = new Set(); // Track which nodes are collapsed
let viewMode = 'tree'; // 'tree', 'sequential', or 'canvas'
let sortOrder = 'newest'; // 'newest' or 'oldest'

// Tree view selection mode
let selectionMode = false; // Whether multi-select mode is active
let selectedTabs = new Set(); // Set of selected tab IDs

// Dark mode
let darkMode = false; // Whether dark mode is enabled

// Canvas view data
let canvasData = {
  positions: {}, // { tabId: { x, y } }
  groups: {}, // { groupId: { id, name, color, tabs: [tabId], position: { x, y, width, height } } }
};
let gridSnapEnabled = true; // Whether to snap to grid
let gridSize = 20; // Grid size in pixels
let draggedElement = null; // Currently dragged element
let dragOffset = { x: 0, y: 0 }; // Offset from mouse to element top-left
let draggedType = null; // 'tab' or 'group'
let draggedId = null; // ID of dragged element
let originalPosition = null; // Original position before dragging (for collision revert)
let dropTargetGroup = null; // Group that tab is being dragged over
let hideChildren = false; // Whether to hide child tabs in canvas view
let expandedParents = new Set(); // Set of parent tab IDs that are expanded in canvas view

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
  document.getElementById('hideChildrenToggle').addEventListener('change', handleHideChildrenToggle);
  document.getElementById('selectionModeBtn').addEventListener('click', toggleSelectionMode);
  document.getElementById('darkModeBtn').addEventListener('click', toggleDarkMode);
  document.getElementById('createGroupBtn').addEventListener('click', createNewGroup);
  document.getElementById('autoGroupBtn').addEventListener('click', autoGroupByDomain);
  document.getElementById('refreshBtn').addEventListener('click', loadAndRender);
  document.getElementById('saveSessionBtn').addEventListener('click', saveSession);
  document.getElementById('loadSessionBtn').addEventListener('click', () => {
    document.getElementById('sessionFileInput').click();
  });
  document.getElementById('sessionFileInput').addEventListener('change', loadSession);
  document.getElementById('clearBtn').addEventListener('click', clearHistory);

  // Load and display tabs
  loadAndRender();

  // Listen for storage changes to update in real-time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.tabs) {
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
  const hideChildrenLabel = document.getElementById('hideChildrenToggleLabel');
  const createGroupBtn = document.getElementById('createGroupBtn');
  const autoGroupBtn = document.getElementById('autoGroupBtn');
  gridSnapLabel.style.display = mode === 'canvas' ? 'flex' : 'none';
  hideChildrenLabel.style.display = mode === 'canvas' ? 'flex' : 'none';
  createGroupBtn.style.display = mode === 'canvas' ? 'block' : 'none';
  autoGroupBtn.style.display = mode === 'canvas' ? 'block' : 'none';

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
function saveSession() {
  const sessionData = {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    tabs: tabsData,
    canvasData: canvasData,
    darkMode: darkMode
  };

  const dataStr = JSON.stringify(sessionData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `tab-session-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('Session saved (tabs + canvas layout + groups + preferences)');
}

// Load session from file
function loadSession(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const sessionData = JSON.parse(e.target.result);

      // Validate session data
      if (!sessionData.tabs) {
        alert('Invalid session file format');
        return;
      }

      // Ask user if they want to merge or replace
      const merge = confirm(
        'Load session:\n\n' +
        'OK = Merge with current tabs\n' +
        'Cancel = Replace current tabs\n\n' +
        `Session from: ${new Date(sessionData.timestamp).toLocaleString()}`
      );

      if (merge) {
        // Merge: keep existing tabs and add session tabs
        const mergedTabs = { ...sessionData.tabs, ...tabsData };
        await chrome.storage.local.set({ tabs: mergedTabs });

        // Merge canvas data if available
        if (sessionData.canvasData) {
          const mergedCanvasData = {
            positions: { ...canvasData.positions, ...sessionData.canvasData.positions },
            groups: { ...canvasData.groups, ...sessionData.canvasData.groups }
          };
          await chrome.storage.local.set({ canvasData: mergedCanvasData });
        }
      } else {
        // Replace: use only session data
        await chrome.storage.local.set({ tabs: sessionData.tabs });

        // Replace canvas data if available
        if (sessionData.canvasData) {
          await chrome.storage.local.set({ canvasData: sessionData.canvasData });
        }

        // Restore dark mode preference if available
        if (sessionData.darkMode !== undefined) {
          await chrome.storage.local.set({ darkMode: sessionData.darkMode });
        }
      }

      // Reload the view
      await loadAndRender();
      console.log('Session loaded (tabs + canvas layout + groups + preferences)');
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load session file. Make sure it\'s a valid JSON file.');
    }
  };

  reader.readAsText(file);

  // Reset file input so the same file can be loaded again
  event.target.value = '';
}

// Clear all history
async function clearHistory() {
  if (!confirm('Are you sure you want to clear all tab history? This cannot be undone.')) {
    return;
  }

  await chrome.storage.local.set({ tabs: {} });
  tabsData = {};
  collapsedNodes.clear();
  render();
  updateStats();
}

// ===== CANVAS VIEW FUNCTIONS =====

// Handle grid snap toggle
function handleGridSnapToggle(event) {
  gridSnapEnabled = event.target.checked;
}

// Handle hide children toggle
function handleHideChildrenToggle(event) {
  hideChildren = event.target.checked;
  if (!hideChildren) {
    // When showing all tabs again, clear expanded state
    expandedParents.clear();
  }
  render();
}

// Toggle expand/collapse for a parent tab in canvas view
function toggleParentExpand(parentId) {
  if (expandedParents.has(parentId)) {
    expandedParents.delete(parentId);
  } else {
    expandedParents.add(parentId);
  }
  render();
}

// Get all child tab IDs for a given parent (recursively)
function getAllChildren(parentId) {
  const children = new Set();
  const findChildren = (tabId) => {
    Object.values(tabsData).forEach(tab => {
      if (tab.parentId === tabId) {
        children.add(tab.id);
        findChildren(tab.id); // Recursive
      }
    });
  };
  findChildren(parentId);
  return children;
}

// Check if a tab has any children
function hasChildren(tabId) {
  return Object.values(tabsData).some(tab => tab.parentId === tabId);
}

// Snap coordinate to grid
function snapToGrid(value) {
  if (!gridSnapEnabled) return value;
  return Math.round(value / gridSize) * gridSize;
}

// Create a new group
function createNewGroup() {
  const groupName = prompt('Enter group name:', 'New Group');
  if (!groupName) return;

  const groupId = 'group_' + Date.now();
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
  const color = colors[Object.keys(canvasData.groups).length % colors.length];

  canvasData.groups[groupId] = {
    id: groupId,
    name: groupName,
    color: color,
    tabs: [],
    position: { x: 100, y: 100, width: 300, height: 200 }
  };

  saveCanvasData();
  render();
}

// Auto-group tabs by domain
function autoGroupByDomain() {
  if (!confirm('This will create groups based on website domains. Continue?')) return;

  // Clear existing groups
  canvasData.groups = {};

  // Get active tabs
  const activeTabs = Object.values(tabsData).filter(tab => tab.active);

  // Group tabs by domain
  const domainMap = {};
  activeTabs.forEach(tab => {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname.replace(/^www\./, ''); // Remove www. prefix

      if (!domainMap[domain]) {
        domainMap[domain] = [];
      }
      domainMap[domain].push(tab.id);
    } catch (e) {
      // Skip invalid URLs
    }
  });

  // Create groups for domains with 2+ tabs
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
  let groupIndex = 0;
  let yOffset = 50;

  Object.entries(domainMap).forEach(([domain, tabIds]) => {
    if (tabIds.length >= 2) {
      const groupId = 'group_' + Date.now() + '_' + groupIndex;
      const color = colors[groupIndex % colors.length];

      // Capitalize domain name nicely
      const groupName = domain.split('.')[0].charAt(0).toUpperCase() +
                       domain.split('.')[0].slice(1);

      // Calculate group size based on number of tabs
      // Arrange tabs in 2 columns within the group
      const tabsPerRow = 2;
      const tabWidth = 230;
      const tabHeight = 70;
      const padding = 15;
      const headerHeight = 35;

      const rows = Math.ceil(tabIds.length / tabsPerRow);
      const groupWidth = (tabsPerRow * tabWidth) + ((tabsPerRow + 1) * padding);
      const groupHeight = headerHeight + (rows * tabHeight) + ((rows + 1) * padding);

      canvasData.groups[groupId] = {
        id: groupId,
        name: groupName,
        color: color,
        tabs: tabIds,
        position: { x: 50, y: yOffset, width: groupWidth, height: groupHeight }
      };

      // Position tabs inside the group in a grid layout
      tabIds.forEach((tabId, index) => {
        const row = Math.floor(index / tabsPerRow);
        const col = index % tabsPerRow;

        const tabX = 50 + padding + (col * (tabWidth + padding));
        const tabY = yOffset + headerHeight + padding + (row * (tabHeight + padding));

        canvasData.positions[tabId] = { x: tabX, y: tabY };
      });

      yOffset += groupHeight + 30; // Stack groups vertically with spacing
      groupIndex++;
    }
  });

  saveCanvasData();
  render();

  const groupCount = Object.keys(canvasData.groups).length;
  alert(`Created ${groupCount} group(s) based on domains. Tabs with unique domains remain ungrouped.`);
}

// Delete a group (but keep the tabs)
function deleteGroup(groupId) {
  if (!confirm('Delete this group? Tabs will remain on the canvas.')) return;

  delete canvasData.groups[groupId];
  saveCanvasData();
  render();
}

// Add tab to group
function addTabToGroup(tabId, groupId) {
  if (!canvasData.groups[groupId]) return;

  // Remove from other groups first
  Object.values(canvasData.groups).forEach(group => {
    group.tabs = group.tabs.filter(id => id !== tabId);
  });

  // Add to new group
  canvasData.groups[groupId].tabs.push(tabId);
  saveCanvasData();
  render();
}

// Remove tab from group
function removeTabFromGroup(tabId) {
  Object.values(canvasData.groups).forEach(group => {
    group.tabs = group.tabs.filter(id => id !== tabId);
  });
  saveCanvasData();
  render();
}

// Render canvas view
function renderCanvas() {
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

  // Filter by hide children setting
  if (hideChildren) {
    // Build a set of all children that should be hidden
    const hiddenChildren = new Set();

    tabsArray.forEach(tab => {
      if (tab.parentId && !expandedParents.has(tab.parentId)) {
        // This tab has a parent and the parent is not expanded
        hiddenChildren.add(tab.id);
      }
    });

    // Also hide descendants of hidden children
    const allHidden = new Set(hiddenChildren);
    hiddenChildren.forEach(childId => {
      const descendants = getAllChildren(childId);
      descendants.forEach(descId => allHidden.add(descId));
    });

    tabsArray = tabsArray.filter(tab => !allHidden.has(tab.id));
  }

  if (tabsArray.length === 0) {
    container.innerHTML = '<p class="empty-state">No tabs found. Try a different search or open some tabs!</p>';
    return;
  }

  // Clear container and set up canvas
  container.innerHTML = '';
  container.className = 'canvas-container';

  // Create canvas workspace
  const canvasWorkspace = document.createElement('div');
  canvasWorkspace.className = 'canvas-workspace';
  canvasWorkspace.id = 'canvasWorkspace';

  // Render groups first (so tabs render on top)
  Object.values(canvasData.groups).forEach(group => {
    const groupElement = renderCanvasGroup(group);
    canvasWorkspace.appendChild(groupElement);
  });

  // Render tabs
  tabsArray.forEach(tab => {
    const tabElement = renderCanvasTab(tab);
    canvasWorkspace.appendChild(tabElement);
  });

  container.appendChild(canvasWorkspace);

  // Set up drag and drop event listeners
  setupCanvasDragAndDrop();
}

// Render a single tab in canvas view
function renderCanvasTab(tab) {
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
    canvasData.positions[tab.id] = position;
  }

  tabDiv.style.left = position.x + 'px';
  tabDiv.style.top = position.y + 'px';

  // Build tab content
  const headerDiv = document.createElement('div');
  headerDiv.className = 'canvas-tab-header';

  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'canvas-tab-drag-handle';
  dragHandle.textContent = '⋮⋮';
  headerDiv.appendChild(dragHandle);

  // Children indicator (dot) if tab has children
  const tabHasChildren = hasChildren(tab.id);
  if (tabHasChildren) {
    const childrenDot = document.createElement('div');
    childrenDot.className = 'canvas-tab-children-dot';

    // Show different states based on expand/collapse
    if (hideChildren) {
      const isExpanded = expandedParents.has(tab.id);
      childrenDot.textContent = isExpanded ? '▼' : '▶';
      childrenDot.classList.add('expandable');
      childrenDot.title = isExpanded ? 'Click to collapse children' : 'Click to expand children';
      childrenDot.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleParentExpand(tab.id);
      });
    } else {
      childrenDot.textContent = '●';
      const childCount = getAllChildren(tab.id).size;
      childrenDot.title = `Has ${childCount} child tab(s)`;
    }

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
function renderCanvasGroup(group) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'canvas-group';
  groupDiv.dataset.groupId = group.id;
  groupDiv.draggable = true;

  const pos = group.position;
  groupDiv.style.left = pos.x + 'px';
  groupDiv.style.top = pos.y + 'px';
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

  // Tab count
  const countSpan = document.createElement('span');
  countSpan.className = 'canvas-group-count';
  countSpan.textContent = `(${group.tabs.length})`;
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

// Show context menu for tab
function showTabContextMenu(tabId, x, y) {
  // Remove existing context menu
  const existing = document.querySelector('.canvas-context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'canvas-context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  // Check if tab is in a group
  const currentGroup = Object.values(canvasData.groups).find(g => g.tabs.includes(tabId));

  if (currentGroup) {
    // Option to remove from group
    const removeItem = document.createElement('div');
    removeItem.className = 'canvas-context-menu-item';
    removeItem.textContent = 'Remove from group';
    removeItem.onclick = () => {
      removeTabFromGroup(tabId);
      menu.remove();
    };
    menu.appendChild(removeItem);
  } else {
    // Option to add to groups
    const groups = Object.values(canvasData.groups);
    if (groups.length > 0) {
      groups.forEach(group => {
        const addItem = document.createElement('div');
        addItem.className = 'canvas-context-menu-item';
        addItem.textContent = `Add to "${group.name}"`;
        addItem.onclick = () => {
          addTabToGroup(tabId, group.id);
          menu.remove();
        };
        menu.appendChild(addItem);
      });
    } else {
      const noGroupItem = document.createElement('div');
      noGroupItem.className = 'canvas-context-menu-item disabled';
      noGroupItem.textContent = 'No groups available';
      menu.appendChild(noGroupItem);
    }
  }

  document.body.appendChild(menu);

  // Close menu on click outside
  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 0);
}

// Check if two rectangles overlap
function checkCollision(rect1, rect2) {
  const noOverlap = (
    rect1.x + rect1.width <= rect2.x ||
    rect1.x >= rect2.x + rect2.width ||
    rect1.y + rect1.height <= rect2.y ||
    rect1.y >= rect2.y + rect2.height
  );

  const overlaps = !noOverlap;
  if (overlaps) {
    console.log('Rectangles overlap:', rect1, rect2);
  }

  return overlaps;
}

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

// Check if a new position would cause a collision
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
        console.log(`Collision detected between tab ${id} and tab ${otherId}`);
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
        console.log(`Collision detected between tab ${id} and group ${groupId}`);
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
        console.log(`Collision detected between group ${id} and group ${otherId}`);
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
    }
  });

  // Drag over
  workspace.addEventListener('dragover', (e) => {
    e.preventDefault();

    // Highlight group when dragging tab over it
    if (draggedType === 'tab') {
      const workspaceRect = workspace.getBoundingClientRect();
      const mouseX = e.clientX - workspaceRect.left;
      const mouseY = e.clientY - workspaceRect.top;

      // Check which group (if any) the mouse is over
      let foundGroup = null;
      for (const [groupId, group] of Object.entries(canvasData.groups)) {
        if (
          mouseX >= group.position.x &&
          mouseX <= group.position.x + group.position.width &&
          mouseY >= group.position.y &&
          mouseY <= group.position.y + group.position.height
        ) {
          foundGroup = groupId;
          break;
        }
      }

      // Update visual feedback
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
  workspace.addEventListener('dragend', (e) => {
    if (draggedElement) {
      draggedElement.style.opacity = '1';

      // Remove drop target highlight
      if (dropTargetGroup) {
        const groupEl = workspace.querySelector(`[data-group-id="${dropTargetGroup}"]`);
        if (groupEl) groupEl.classList.remove('drop-target');
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const newX = e.clientX - workspaceRect.left - dragOffset.x;
      const newY = e.clientY - workspaceRect.top - dragOffset.y;

      const snappedX = snapToGrid(newX);
      const snappedY = snapToGrid(newY);

      if (draggedType === 'tab') {
        const tabWidth = 230;
        const tabHeight = 60;

        console.log(`Checking collision for tab ${draggedId} at (${snappedX}, ${snappedY})`);

        // Check for collision
        if (wouldCollide('tab', draggedId, snappedX, snappedY, tabWidth, tabHeight)) {
          // Collision detected - revert to original position
          console.log('Collision detected, reverting position to', originalPosition);
          canvasData.positions[draggedId] = originalPosition;
        } else {
          // No collision - update position
          console.log('No collision, updating position');
          canvasData.positions[draggedId] = { x: snappedX, y: snappedY };

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

        // Check for collision
        if (wouldCollide('group', draggedId, snappedX, snappedY, group.position.width, group.position.height)) {
          // Collision detected - revert to original position
          console.log('Collision detected, reverting position');
          group.position.x = originalPosition.x;
          group.position.y = originalPosition.y;
        } else {
          // No collision - calculate how much the group moved
          const deltaX = snappedX - group.position.x;
          const deltaY = snappedY - group.position.y;

          // Update group position
          group.position.x = snappedX;
          group.position.y = snappedY;

          // Move all tabs in the group by the same delta
          group.tabs.forEach(tabId => {
            if (canvasData.positions[tabId]) {
              canvasData.positions[tabId].x += deltaX;
              canvasData.positions[tabId].y += deltaY;
            }
          });
        }
      }

      saveCanvasData();
      render();

      draggedElement = null;
      draggedType = null;
      draggedId = null;
      originalPosition = null;
      dropTargetGroup = null;
    }
  });
}

// Save canvas data to storage
async function saveCanvasData() {
  await chrome.storage.local.set({ canvasData });
}

// Utility function to escape HTML (prevent XSS)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
