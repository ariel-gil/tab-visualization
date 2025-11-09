// sequential-view.js - Sequential (chronological) view rendering

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
