// group-manager.js - Handles group creation, modification, and management
// Requires: canvasData, tabsData, saveCanvasData(), render(), wouldCollide()

// Create a new empty group
function createNewGroup() {
  const groupName = prompt('Enter group name:', 'New Group');
  if (!groupName) return;

  const groupId = 'group_' + Date.now();
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
  const color = colors[Object.keys(canvasData.groups).length % colors.length];

  // Find an empty position that doesn't collide with existing elements
  const groupWidth = 300;
  const groupHeight = 200;
  let foundPosition = false;
  let x = 50;
  let y = 50;

  // Try positions in a grid pattern until we find an empty spot
  for (let row = 0; row < 20 && !foundPosition; row++) {
    for (let col = 0; col < 10 && !foundPosition; col++) {
      x = 50 + (col * 350); // 350 = groupWidth + 50px spacing
      y = 50 + (row * 250); // 250 = groupHeight + 50px spacing

      // Check if this position collides with anything
      if (!wouldCollide('group', groupId, x, y, groupWidth, groupHeight)) {
        foundPosition = true;
      }
    }
  }

  canvasData.groups[groupId] = {
    id: groupId,
    name: groupName,
    color: color,
    tabs: [],
    position: { x, y, width: groupWidth, height: groupHeight }
  };

  saveCanvasData();
  render();
}

// Auto-group tabs by domain
function autoGroupByDomain() {
  if (!confirm('This will create groups based on website domains for ungrouped tabs. Manually created groups will be preserved. Continue?')) return;

  // Keep track of existing manual groups and their tabs
  const manualGroups = {};
  const tabsInManualGroups = new Set();

  Object.entries(canvasData.groups).forEach(([groupId, group]) => {
    manualGroups[groupId] = group;
    group.tabs.forEach(tabId => tabsInManualGroups.add(tabId));
  });

  // Get active tabs that are NOT in manual groups
  const activeTabs = Object.values(tabsData).filter(tab =>
    tab.active && !tabsInManualGroups.has(tab.id)
  );

  // Clear positions ONLY for tabs not in manual groups (so we can reposition them)
  const newPositions = {};
  // Preserve positions of tabs in manual groups
  Object.entries(canvasData.positions).forEach(([tabId, pos]) => {
    if (tabsInManualGroups.has(parseInt(tabId))) {
      newPositions[tabId] = pos;
    }
  });
  canvasData.positions = newPositions;

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

  // Start with existing manual groups
  const newGroups = { ...manualGroups };

  // Find the starting Y offset (below manual groups)
  let yOffset = 50;
  Object.values(manualGroups).forEach(group => {
    const groupBottom = group.position.y + group.position.height;
    if (groupBottom + 30 > yOffset) {
      yOffset = groupBottom + 30;
    }
  });

  // Create groups for domains with 2+ tabs
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
  let groupIndex = Object.keys(manualGroups).length; // Start color index after manual groups

  Object.entries(domainMap).forEach(([domain, tabIds]) => {
    if (tabIds.length >= 2) {
      const groupId = 'group_' + Date.now() + '_' + groupIndex;
      const color = colors[groupIndex % colors.length];

      // Capitalize domain name nicely
      const groupName = domain.split('.')[0].charAt(0).toUpperCase() +
                       domain.split('.')[0].slice(1);

      // Calculate group size based on number of ACTIVE tabs only
      // Arrange tabs in 2 columns within the group
      const { groupWidth, groupHeight } = calculateGroupSize(tabIds);

      newGroups[groupId] = {
        id: groupId,
        name: groupName,
        color: color,
        tabs: tabIds,
        position: { x: 50, y: yOffset, width: groupWidth, height: groupHeight }
      };

      // Position tabs inside the group in a grid layout
      positionTabsInGroup(tabIds, 50, yOffset);

      yOffset += groupHeight + 30; // Stack groups vertically with spacing
      groupIndex++;
    }
  });

  // Position ungrouped tabs (tabs not in any group including manual ones) to the right
  positionUngroupedTabs(newGroups);

  // Update groups with preserved manual groups + new auto groups
  canvasData.groups = newGroups;

  saveCanvasData();
  render();

  const newGroupCount = Object.keys(newGroups).length - Object.keys(manualGroups).length;
  const manualGroupCount = Object.keys(manualGroups).length;
  alert(`Created ${newGroupCount} new auto-group(s) based on domains.\n${manualGroupCount} manual group(s) preserved.\nTabs with unique domains remain ungrouped.`);
}

// Helper: Calculate group size based on tabs
function calculateGroupSize(tabIds) {
  const tabsPerRow = 2;
  const tabWidth = 230;
  const tabHeight = 70;
  const padding = 15;
  const headerHeight = 35;

  // Only count active tabs for sizing
  const activeTabIds = tabIds.filter(id => tabsData[id] && tabsData[id].active);
  const rows = Math.ceil(activeTabIds.length / tabsPerRow);
  const groupWidth = (tabsPerRow * tabWidth) + ((tabsPerRow + 1) * padding);
  const groupHeight = headerHeight + (rows * tabHeight) + ((rows + 1) * padding);

  return { groupWidth, groupHeight };
}

// Helper: Position tabs inside a group in grid layout
function positionTabsInGroup(tabIds, groupX, groupY) {
  const tabsPerRow = 2;
  const tabWidth = 230;
  const tabHeight = 70;
  const padding = 15;
  const headerHeight = 35;

  tabIds.forEach((tabId, index) => {
    const row = Math.floor(index / tabsPerRow);
    const col = index % tabsPerRow;

    const tabX = groupX + padding + (col * (tabWidth + padding));
    const tabY = groupY + headerHeight + padding + (row * (tabHeight + padding));

    canvasData.positions[tabId] = { x: tabX, y: tabY };
  });
}

// Helper: Position ungrouped tabs in columns
function positionUngroupedTabs(groups) {
  const ungroupedX = 600; // Start to the right of grouped tabs
  const ungroupedY = 50;
  const ungroupedTabWidth = 230;
  const ungroupedTabHeight = 70;
  const ungroupedPadding = 15;
  const ungroupedPerColumn = 8;

  // Get all active tabs
  const allActiveTabs = Object.values(tabsData).filter(tab => tab.active);

  allActiveTabs.forEach(tab => {
    // Check if tab is in ANY group (manual or auto)
    const inAnyGroup = Object.values(groups).some(g => g.tabs.includes(tab.id));

    if (!inAnyGroup && !canvasData.positions[tab.id]) {
      // Position ungrouped tab
      const index = Object.keys(canvasData.positions).filter(id =>
        !Object.values(groups).some(g => g.tabs.includes(parseInt(id)))
      ).length;

      const row = index % ungroupedPerColumn;
      const col = Math.floor(index / ungroupedPerColumn);

      canvasData.positions[tab.id] = {
        x: ungroupedX + (col * (ungroupedTabWidth + ungroupedPadding)),
        y: ungroupedY + (row * (ungroupedTabHeight + ungroupedPadding))
      };
    }
  });
}

// Clear all auto-generated groups (preserve manual groups)
async function clearAutoGroups() {
  if (!confirm('Clear all auto-generated groups? Manual groups will be preserved.\n\nTabs will remain on the canvas.')) {
    return;
  }

  // Identify auto-generated groups
  // Auto-groups have IDs like: group_timestamp_index
  // Manual groups have IDs like: group_timestamp (no underscore after timestamp)
  const manualGroups = {};
  const autoGroupIds = [];

  Object.entries(canvasData.groups).forEach(([groupId, group]) => {
    // Check if this is an auto-group by looking at the ID pattern
    const parts = groupId.split('_');
    if (parts.length === 3 && !isNaN(parts[2])) {
      // This is an auto-group (has index suffix)
      autoGroupIds.push(groupId);
    } else {
      // This is a manual group
      manualGroups[groupId] = group;
    }
  });

  // Remove auto-groups
  canvasData.groups = manualGroups;

  // Tabs from removed groups stay in their current positions

  await saveCanvasData();
  render();

  alert(`Removed ${autoGroupIds.length} auto-generated group(s).\n${Object.keys(manualGroups).length} manual group(s) preserved.`);
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

  const group = canvasData.groups[groupId];

  // Remove from other groups first
  Object.values(canvasData.groups).forEach(g => {
    g.tabs = g.tabs.filter(id => id !== tabId);
  });

  // Add to new group
  group.tabs.push(tabId);

  // Position the tab inside the group
  // Arrange tabs in a 2-column grid inside the group
  const tabsPerRow = 2;
  const tabWidth = 230;
  const tabHeight = 70;
  const padding = 15;
  const headerHeight = 35;

  // Count only active tabs in the group for positioning
  const activeTabsInGroup = group.tabs.filter(id => tabsData[id] && tabsData[id].active);
  const index = activeTabsInGroup.length - 1; // Index of the newly added tab
  const row = Math.floor(index / tabsPerRow);
  const col = index % tabsPerRow;

  const tabX = group.position.x + padding + (col * (tabWidth + padding));
  const tabY = group.position.y + headerHeight + padding + (row * (tabHeight + padding));

  canvasData.positions[tabId] = { x: tabX, y: tabY };

  // Expand group if necessary to fit all active tabs
  const rows = Math.ceil(activeTabsInGroup.length / tabsPerRow);
  const minGroupWidth = (tabsPerRow * tabWidth) + ((tabsPerRow + 1) * padding);
  const minGroupHeight = headerHeight + (rows * tabHeight) + ((rows + 1) * padding);

  group.position.width = Math.max(group.position.width, minGroupWidth);
  group.position.height = Math.max(group.position.height, minGroupHeight);

  saveCanvasData();
  render();
}

// Remove tab from group
function removeTabFromGroup(tabId) {
  // Find which group the tab is in
  const currentGroup = Object.values(canvasData.groups).find(g => g.tabs.includes(tabId));

  // Remove from all groups
  Object.values(canvasData.groups).forEach(group => {
    group.tabs = group.tabs.filter(id => id !== tabId);
  });

  // Move tab outside the group
  if (currentGroup && canvasData.positions[tabId]) {
    // Position the tab to the right of the group with some offset
    const newX = currentGroup.position.x + currentGroup.position.width + 30;
    const newY = currentGroup.position.y;

    canvasData.positions[tabId] = { x: newX, y: newY };
  }

  saveCanvasData();
  render();
}
