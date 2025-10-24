// utils.js - Common utility functions used across the application

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Snap a value to grid
function snapToGrid(value, gridSize = 20) {
  return Math.round(value / gridSize) * gridSize;
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

// Position a popup element on screen, ensuring it stays within viewport bounds
function positionPopupOnScreen(element, x, y) {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let finalX = x;
  let finalY = y;

  // Adjust horizontal position if element goes off right edge
  if (x + rect.width > viewportWidth) {
    finalX = viewportWidth - rect.width - 10;
  }

  // Adjust vertical position if element goes off bottom edge
  if (y + rect.height > viewportHeight) {
    finalY = viewportHeight - rect.height - 10;
  }

  // Make sure element doesn't go off top or left edges
  finalX = Math.max(10, finalX);
  finalY = Math.max(10, finalY);

  element.style.left = finalX + 'px';
  element.style.top = finalY + 'px';

  return { x: finalX, y: finalY };
}

// Remove existing element by selector
function removeExistingElement(selector) {
  const existing = document.querySelector(selector);
  if (existing) existing.remove();
}

// Setup click-outside-to-close for popup elements
function setupClickOutsideToClose(element) {
  setTimeout(() => {
    document.addEventListener('click', () => element.remove(), { once: true });
  }, 0);
}

// Create a DOM element with className and optional textContent
function createElement(tag, className = '', textContent = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

// Create a favicon image element
function createFaviconElement(url, className = 'favicon') {
  const favicon = document.createElement('img');
  favicon.className = className;
  favicon.src = url;
  favicon.onerror = () => { favicon.style.display = 'none'; };
  return favicon;
}

// Get all children of a tab recursively
// Note: Uses global tabsData variable
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

// Check if a tab has children
// Note: Uses global tabsData variable
function hasChildren(tabId) {
  return Object.values(tabsData).some(tab => tab.parentId === tabId);
}

// Collect all descendants with depth information
// Note: Uses global tabsData variable
function collectChildrenWithDepth(parentId, startDepth = 0) {
  const children = [];
  const collectRecursive = (tabId, depth) => {
    Object.values(tabsData).forEach(tab => {
      if (tab.parentId === tabId) {
        children.push({ tab, depth });
        collectRecursive(tab.id, depth + 1);
      }
    });
  };
  collectRecursive(parentId, startDepth);
  return children;
}

// Check for circular parent-child relationships
// Note: Uses global tabsData variable
function wouldCreateCircularRelationship(childId, parentId) {
  // Don't allow a tab to be its own parent
  if (childId === parentId) {
    return true;
  }

  // Check if parent is a descendant of child (would create a circle)
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

  return descendants.has(childId);
}

// Format timestamp for display
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Get domain from URL
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return 'Unknown';
  }
}

// Capitalize first letter of string
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
