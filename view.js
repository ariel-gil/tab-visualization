// View.js - Handles the visualization of tab relationships

let tabsData = {}; // Will store all tabs from chrome.storage
let searchTerm = ''; // Current search filter

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  document.getElementById('refreshBtn').addEventListener('click', loadAndRender);
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
});

// Load tab data from storage and render the tree
async function loadAndRender() {
  const { tabs = {} } = await chrome.storage.local.get('tabs');
  tabsData = tabs;
  renderTree();
  updateStats();
}

// Handle search input
function handleSearch(event) {
  searchTerm = event.target.value.toLowerCase();
  renderTree();
}

// Build tree structure from flat tab data
function buildTree() {
  // Convert tabs object to array
  const tabsArray = Object.values(tabsData);

  // Filter by search term if present
  const filteredTabs = tabsArray.filter(tab => {
    if (!searchTerm) return true;
    return (
      tab.title.toLowerCase().includes(searchTerm) ||
      tab.url.toLowerCase().includes(searchTerm)
    );
  });

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
  nodeDiv.className = `tree-node ${node.active ? 'active' : 'inactive'} ${isRoot ? 'root' : ''}`;

  // Format timestamp
  const time = new Date(node.timestamp).toLocaleString();

  // Create node HTML
  nodeDiv.innerHTML = `
    <div class="node-header">
      <div class="node-title">${escapeHtml(node.title)}</div>
      <span class="node-status ${node.active ? 'active' : 'closed'}">
        ${node.active ? 'Active' : 'Closed'}
      </span>
    </div>
    <div class="node-meta">
      Opened: ${time}
    </div>
  `;

  // Add click handler for active tabs to jump to them
  if (node.active) {
    nodeDiv.style.cursor = 'pointer';
    nodeDiv.addEventListener('click', async (event) => {
      // Stop propagation to prevent triggering parent node clicks
      event.stopPropagation();

      try {
        // Get the tab to find which window it's in
        const tab = await chrome.tabs.get(node.id);

        // Focus the window first
        await chrome.windows.update(tab.windowId, { focused: true });

        // Then activate the tab
        await chrome.tabs.update(node.id, { active: true });
      } catch (error) {
        console.error('Failed to switch to tab:', error);
        // Tab might have been closed, reload the view
        loadAndRender();
      }
    });
  }

  // Render children if any
  if (node.children && node.children.length > 0) {
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

// Update statistics
function updateStats() {
  const tabsArray = Object.values(tabsData);
  const activeTabs = tabsArray.filter(t => t.active).length;
  const closedTabs = tabsArray.filter(t => !t.active).length;

  document.getElementById('totalTabs').textContent = `Total tabs: ${tabsArray.length}`;
  document.getElementById('activeTabs').textContent = `Active: ${activeTabs}`;
  document.getElementById('closedTabs').textContent = `Closed: ${closedTabs}`;
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
  renderTree();
  updateStats();
}

// Utility function to escape HTML (prevent XSS)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
