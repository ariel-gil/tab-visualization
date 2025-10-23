// popup-utils.js - Utilities for popups, context menus, and children popups
// Requires: tabsData, canvasData, currentActiveTabId, render(), loadAndRender()

// Show children popup for a tab
function showChildrenPopup(parentId, x, y) {
  // Remove existing popup
  removeExistingElement('.canvas-children-popup');

  // Get all children recursively
  const children = collectChildrenWithDepth(parentId, tabsData);

  if (children.length === 0) return;

  const popup = createElement('div', 'canvas-children-popup');

  // Header
  const header = createElement('div', 'canvas-children-popup-header', `Children (${children.length})`);
  popup.appendChild(header);

  // Children list
  children.forEach(({ tab, depth }) => {
    const item = createChildrenPopupItem(tab, depth, popup);
    popup.appendChild(item);
  });

  document.body.appendChild(popup);

  // Position the popup, ensuring it stays on-screen
  positionPopupOnScreen(popup, x, y);

  // Close popup on click outside
  setupClickOutsideToClose(popup);
}

// Helper: Create a single children popup item
function createChildrenPopupItem(tab, depth, popup) {
  const item = createElement('div', `canvas-children-popup-item ${tab.active ? 'active' : 'inactive'}`);
  item.style.paddingLeft = (10 + depth * 15) + 'px';

  // Favicon
  if (tab.favIconUrl) {
    const favicon = createFaviconElement(tab.favIconUrl, 'popup-favicon');
    item.appendChild(favicon);
  }

  // Title
  const title = createElement('span', 'popup-title', tab.title);
  item.appendChild(title);

  // Status
  const status = createElement('span', `popup-status ${tab.active ? 'active' : 'closed'}`, tab.active ? 'Active' : 'Closed');
  item.appendChild(status);

  // Click to navigate to tab (if active)
  if (tab.active) {
    item.style.cursor = 'pointer';
    item.addEventListener('click', async () => {
      try {
        const tabInfo = await chrome.tabs.get(tab.id);
        await chrome.windows.update(tabInfo.windowId, { focused: true });
        await chrome.tabs.update(tab.id, { active: true });
        currentActiveTabId = tab.id;
        popup.remove();
        render();
      } catch (error) {
        console.error('Failed to switch to tab:', error);
        popup.remove();
        loadAndRender();
      }
    });
  }

  return item;
}

// Show context menu for tab
function showTabContextMenu(tabId, x, y) {
  console.log('=== showTabContextMenu called ===');
  console.log('TabId:', tabId, 'Position:', x, y);
  console.log('Is fullscreen?', !!document.fullscreenElement);

  // Remove existing context menu
  removeExistingElement('.canvas-context-menu');

  const menu = createElement('div', 'canvas-context-menu');
  console.log('Menu element created');

  // Add comment section
  addCommentMenuItems(menu, tabId);

  // Separator
  const separator = document.createElement('div');
  separator.style.borderTop = '1px solid #ddd';
  separator.style.margin = '4px 0';
  menu.appendChild(separator);

  // Add group section
  addGroupMenuItems(menu, tabId);

  document.body.appendChild(menu);
  console.log('Menu appended to body');

  // Position the menu, ensuring it stays on-screen
  positionPopupOnScreen(menu, x, y);

  console.log('Menu positioned at:', menu.style.left, menu.style.top);
  console.log('Menu rect:', menu.getBoundingClientRect());
  console.log('Menu computed style z-index:', window.getComputedStyle(menu).zIndex);
  console.log('Menu element in DOM?', document.body.contains(menu));

  // Close menu on click outside
  setupClickOutsideToClose(menu);
}

// Helper: Add comment menu items to context menu
function addCommentMenuItems(menu, tabId) {
  const hasComment = tabsData[tabId] && tabsData[tabId].comment;

  const commentItem = createElement('div', 'canvas-context-menu-item', hasComment ? '✏️ Edit Comment' : '💬 Add Comment');
  commentItem.onclick = () => {
    showTabCommentPopup(tabId);
    menu.remove();
  };
  menu.appendChild(commentItem);

  // Delete comment option if comment exists
  if (hasComment) {
    const deleteCommentItem = createElement('div', 'canvas-context-menu-item', '🗑️ Delete Comment');
    deleteCommentItem.onclick = () => {
      deleteTabComment(tabId);
      menu.remove();
    };
    menu.appendChild(deleteCommentItem);
  }
}

// Helper: Add group menu items to context menu
function addGroupMenuItems(menu, tabId) {
  // Check if tab is in a group
  const currentGroup = Object.values(canvasData.groups).find(g => g.tabs.includes(tabId));

  if (currentGroup) {
    // Option to remove from group
    const removeItem = createElement('div', 'canvas-context-menu-item', 'Remove from group');
    removeItem.onclick = () => {
      removeTabFromGroup(tabId);
      menu.remove();
    };
    menu.appendChild(removeItem);
  } else {
    // Option to add to groups
    const groups = Object.values(canvasData.groups);
    if (groups.length > 0) {
      // Add search input if there are many groups
      if (groups.length > 5) {
        const searchInput = createGroupSearchInput(menu);
        menu.appendChild(searchInput);
      }

      groups.forEach(group => {
        const addItem = createElement('div', 'canvas-context-menu-item', `Add to "${group.name}"`);
        addItem.onclick = () => {
          addTabToGroup(tabId, group.id);
          menu.remove();
        };
        menu.appendChild(addItem);
      });
    } else {
      const noGroupItem = createElement('div', 'canvas-context-menu-item disabled', 'No groups available');
      menu.appendChild(noGroupItem);
    }
  }
}

// Helper: Create search input for group menu
function createGroupSearchInput(menu) {
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search groups...';
  searchInput.className = 'canvas-context-menu-search';
  searchInput.onclick = (e) => e.stopPropagation();
  searchInput.oninput = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const items = menu.querySelectorAll('.canvas-context-menu-item');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
  };
  return searchInput;
}
