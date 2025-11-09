// relationship-manager.js - Manages parent-child relationships between tabs

/**
 * Make a single tab a child of another tab (for canvas drag-drop)
 * @param {number} childId - ID of tab to become a child
 * @param {number} parentId - ID of tab to become the parent
 * @returns {Promise<boolean>} True if relationship was created successfully
 * @note Uses global tabsData variable
 */
async function makeTabChild(childId, parentId) {
  // Don't allow a tab to be its own parent
  if (childId === parentId) {
    alert('Cannot make a tab its own child!');
    return false;
  }

  // Validate that both tabs exist
  if (!tabsData[childId] || !tabsData[parentId]) {
    console.error('Invalid tab IDs:', { childId, parentId });
    alert('One or both tabs no longer exist.');
    return false;
  }

  // Check for circular relationships (parent becoming child of its descendant)
  // FIXED: Check if parent is a descendant of child (would create circle)
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
  collectDescendants(childId); // Start from child, not parent

  if (descendants.has(parentId)) { // Check if parent is in child's descendants
    alert('Cannot create circular parent-child relationships!');
    return false;
  }

  // Update parent relationship
  tabsData[childId].parentId = parentId;

  // Save to storage with error handling
  try {
    await chrome.storage.local.set({ tabs: tabsData });
    return true;
  } catch (error) {
    console.error('Failed to save relationship:', error);
    alert('Failed to save relationship. Please try again.');
    return false;
  }
}

/**
 * Make multiple selected tabs children of a target tab (for multi-select mode)
 * @param {number} parentId - ID of tab to become the parent
 * @returns {Promise<void>}
 * @note Uses global selectedTabs, tabsData, selectionMode variables
 */
async function makeTabsChildren(parentId) {
  if (selectedTabs.size === 0) return;

  // Validate parent tab exists
  if (!tabsData[parentId]) {
    console.error('Parent tab does not exist:', parentId);
    alert('Parent tab no longer exists.');
    return;
  }

  // Don't allow a tab to be its own parent
  if (selectedTabs.has(parentId)) {
    alert('Cannot make a tab its own child!');
    return;
  }

  // Check for circular relationships (parent becoming child of its descendant)
  // For each selected tab, check if parent would be its descendant
  for (const selectedId of selectedTabs) {
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
    collectDescendants(selectedId); // Start from child (selected tab)

    if (descendants.has(parentId)) { // Check if parent is in child's descendants
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

  // Save to storage with error handling
  try {
    await chrome.storage.local.set({ tabs: tabsData });
  } catch (error) {
    console.error('Failed to save relationships:', error);
    alert('Failed to save relationships. Please try again.');
    return;
  }

  // Clear selection and exit selection mode
  selectedTabs.clear();
  selectionMode = false;
  const btn = document.getElementById('selectionModeBtn');
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = 'Multi-Select Mode';
  }

  // Reload and render
  try {
    await loadAndRender();
  } catch (error) {
    console.error('Failed to reload after relationship update:', error);
  }
}
