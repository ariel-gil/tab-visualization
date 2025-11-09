// tree-view.js - Tree view rendering with parent-child hierarchy

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
  const hasChildrenNodes = node.children && node.children.length > 0;
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
  if (hasChildrenNodes) {
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
  if (hasChildrenNodes) {
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
