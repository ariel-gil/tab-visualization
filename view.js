// View.js - Handles the visualization of tab relationships

let tabsData = {}; // Will store all tabs from chrome.storage
let searchTerm = ''; // Current search filter
let showClosedTabs = true; // Toggle for showing closed tabs
let currentActiveTabId = null; // ID of the currently active tab
let collapsedNodes = new Set(); // Track which nodes are collapsed
let viewMode = 'tree'; // 'tree', 'sequential', or 'canvas'
let sortOrder = 'newest'; // 'newest' or 'oldest'

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
  document.getElementById('createGroupBtn').addEventListener('click', createNewGroup);
  document.getElementById('refreshBtn').addEventListener('click', loadAndRender);
  document.getElementById('saveSessionBtn').addEventListener('click', saveSession);
  document.getElementById('loadSessionBtn').addEventListener('click', () => {
    document.getElementById('sessionFileInput').click();
  });
  document.getElementById('sessionFileInput').addEventListener('change', loadSession);
  document.getElementById('exportBtn').addEventListener('click', exportData);
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
  const { tabs = {}, canvasData: savedCanvasData = null } = await chrome.storage.local.get(['tabs', 'canvasData']);
  tabsData = tabs;

  // Load canvas data if available
  if (savedCanvasData) {
    canvasData = savedCanvasData;
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
  gridSnapLabel.style.display = mode === 'canvas' ? 'flex' : 'none';
  createGroupBtn.style.display = mode === 'canvas' ? 'block' : 'none';

  render();
}

// Handle sort order change
function handleSortChange(event) {
  sortOrder = event.target.value;
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

  nodeDiv.className = `tree-node ${node.active ? 'active' : 'inactive'} ${isRoot ? 'root' : ''} ${isCurrentTab ? 'current-active' : ''} ${isCollapsed ? 'collapsed' : ''}`;

  // Format timestamp
  const time = new Date(node.timestamp).toLocaleString();

  // Count children
  const childCount = countDescendants(node);

  // Build node header HTML
  const headerDiv = document.createElement('div');
  headerDiv.className = 'node-header';

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

  // Status badge
  const statusSpan = document.createElement('span');
  statusSpan.className = `node-status ${node.active ? 'active' : 'closed'}`;
  statusSpan.textContent = node.active ? 'Active' : 'Closed';
  headerDiv.appendChild(statusSpan);

  nodeDiv.appendChild(headerDiv);

  // Meta info
  const metaDiv = document.createElement('div');
  metaDiv.className = 'node-meta';
  metaDiv.textContent = `Opened: ${time}`;
  nodeDiv.appendChild(metaDiv);

  // Add click handler for active tabs to jump to them
  if (node.active) {
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

// Save session to file
function saveSession() {
  const sessionData = {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    tabs: tabsData
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

  console.log('Session saved');
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
      } else {
        // Replace: use only session tabs
        await chrome.storage.local.set({ tabs: sessionData.tabs });
      }

      // Reload the view
      await loadAndRender();
      console.log('Session loaded');
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load session file. Make sure it\'s a valid JSON file.');
    }
  };

  reader.readAsText(file);

  // Reset file input so the same file can be loaded again
  event.target.value = '';
}

// Export data as JSON
function exportData() {
  const dataStr = JSON.stringify(tabsData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `tab-journey-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const inGroup = Object.values(canvasData.groups).some(g => g.tabs.includes(tab.id));

  tabDiv.className = `canvas-tab ${tab.active ? 'active' : 'inactive'} ${isCurrentTab ? 'current-active' : ''}`;
  tabDiv.dataset.tabId = tab.id;
  tabDiv.draggable = true;

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

  // Status badge
  const statusSpan = document.createElement('span');
  statusSpan.className = `node-status ${tab.active ? 'active' : 'closed'}`;
  statusSpan.textContent = tab.active ? 'Active' : 'Closed';
  headerDiv.appendChild(statusSpan);

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

      const rect = target.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      target.style.opacity = '0.5';
    } else if (target.classList.contains('canvas-group')) {
      draggedType = 'group';
      draggedId = target.dataset.groupId;
      draggedElement = target;

      const rect = target.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      target.style.opacity = '0.5';
    }
  });

  // Drag over
  workspace.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  // Drag end
  workspace.addEventListener('dragend', (e) => {
    if (draggedElement) {
      draggedElement.style.opacity = '1';

      const workspaceRect = workspace.getBoundingClientRect();
      const newX = e.clientX - workspaceRect.left - dragOffset.x;
      const newY = e.clientY - workspaceRect.top - dragOffset.y;

      const snappedX = snapToGrid(newX);
      const snappedY = snapToGrid(newY);

      if (draggedType === 'tab') {
        canvasData.positions[draggedId] = { x: snappedX, y: snappedY };
      } else if (draggedType === 'group') {
        canvasData.groups[draggedId].position.x = snappedX;
        canvasData.groups[draggedId].position.y = snappedY;
      }

      saveCanvasData();
      render();

      draggedElement = null;
      draggedType = null;
      draggedId = null;
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
