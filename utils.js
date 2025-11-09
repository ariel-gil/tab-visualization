// utils.js - Common utility functions used across the application

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe text
 */
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

/**
 * Snap a coordinate value to the nearest grid point
 * @param {number} value - The coordinate value to snap
 * @param {number} [gridSize=20] - Grid size in pixels
 * @returns {number} Snapped coordinate value
 */
function snapToGrid(value, gridSize = 20) {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Check if two rectangles overlap (collision detection)
 * @param {Object} rect1 - First rectangle {x, y, width, height}
 * @param {Object} rect2 - Second rectangle {x, y, width, height}
 * @returns {boolean} True if rectangles overlap
 */
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

/**
 * Position a popup element on screen, ensuring it stays within viewport bounds
 * @param {HTMLElement} element - The popup element to position
 * @param {number} x - Desired X position
 * @param {number} y - Desired Y position
 */
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

/**
 * Remove an existing DOM element by selector
 * @param {string} selector - CSS selector for element to remove
 */
function removeExistingElement(selector) {
  const existing = document.querySelector(selector);
  if (existing) existing.remove();
}

/**
 * Setup click-outside-to-close behavior for popup elements
 * @param {HTMLElement} element - The popup element to auto-close
 */
function setupClickOutsideToClose(element) {
  setTimeout(() => {
    document.addEventListener('click', () => element.remove(), { once: true });
  }, 0);
}

/**
 * Create a DOM element with className and optional textContent
 * @param {string} tag - HTML tag name (e.g., 'div', 'span')
 * @param {string} [className=''] - CSS class name(s)
 * @param {string} [textContent=''] - Text content for the element
 * @returns {HTMLElement} The created element
 */
function createElement(tag, className = '', textContent = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

/**
 * Create a favicon image element with error handling
 * @param {string} url - Favicon URL
 * @param {string} [className='favicon'] - CSS class name
 * @returns {HTMLImageElement} The favicon image element
 */
function createFaviconElement(url, className = 'favicon') {
  const favicon = document.createElement('img');
  favicon.className = className;
  favicon.src = url;
  favicon.onerror = () => { favicon.style.display = 'none'; };
  return favicon;
}

/**
 * Get all children of a tab recursively
 * @param {number} parentId - The parent tab ID
 * @returns {Set<number>} Set of all descendant tab IDs
 * @note Uses global tabsData variable
 */
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

/**
 * Check if a tab has any children
 * @param {number} tabId - The tab ID to check
 * @returns {boolean} True if tab has children
 * @note Uses global tabsData variable
 */
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

/**
 * Check if making childId a child of parentId would create a circular relationship
 * @param {number} childId - The tab that will become a child
 * @param {number} parentId - The tab that will become the parent
 * @returns {boolean} True if circular relationship would be created
 *
 * Example: If A → B → C exists, making C → A would create a circle
 * We check if parentId is already a descendant of childId
 */
function wouldCreateCircularRelationship(childId, parentId) {
  // Don't allow a tab to be its own parent
  if (childId === parentId) {
    return true;
  }

  // Check if parentId is a descendant of childId (would create a circle)
  // FIXED: Was checking descendants of parentId (backwards logic)
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

  return descendants.has(parentId); // Check if parent is in child's descendants
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
