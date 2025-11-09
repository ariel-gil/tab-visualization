// relationship-manager.js - Manages parent-child relationships between tabs

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

// Make multiple selected tabs children of a target tab
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
