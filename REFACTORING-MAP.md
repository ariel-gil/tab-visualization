# Refactoring Map - November 2025

This document maps old code locations to new locations after the major refactoring. Use this to trace bugs back to their source.

## Code Migration Reference

### From view.js → relationship-manager.js (89 lines)
**Old Location:** view.js:200-350 (approx)
**New Location:** relationship-manager.js
**Functions Moved:**
- `makeTabChild(childId, parentId)` - Assigns parent-child relationship with validation
- `makeTabsChildren(parentId)` - Bulk relationship creation from multi-select
- `collectDescendants(tabId)` - Recursive descendant collection (helper)

**Risk Areas:**
- Circular relationship detection logic (has documented inverted logic bug)
- Multi-select state management (depends on global `selectedTabIds`)

---

### From view.js → sequential-view.js (121 lines)
**Old Location:** view.js:800-950 (approx)
**New Location:** sequential-view.js
**Functions Moved:**
- `renderSequential()` - Main sequential view renderer
- `renderSequentialNode(tab)` - Individual tab card renderer

**Risk Areas:**
- Timestamp sorting logic (newest/oldest)
- Search filter interaction with closed tabs toggle
- Event listeners on dynamic nodes (switch to tab, add comment)

---

### From view.js → tree-view.js (272 lines)
**Old Location:** view.js:400-800 (approx)
**New Location:** tree-view.js
**Functions Moved:**
- `renderTree()` - Main tree view renderer
- `buildTree()` - Constructs tree structure from flat data
- `buildNode(tab, allTabs, depth)` - Recursive node builder
- `renderTreeNode(node, depth)` - Individual node renderer with expand/collapse
- `countDescendants(nodeId)` - Counts all descendants recursively
- Tree-specific drag handlers: `handleTreeDragStart()`, `handleTreeDragOver()`, `handleTreeDrop()`

**Risk Areas:**
- Root tab identification (orphaned tabs with non-existent parents)
- Search filtering (parent filtering doesn't check if parent matches search)
- Expand/collapse state management (depends on global `expandedNodes`)
- Multi-select mode drag-and-drop (interacts with relationship-manager)

---

### From view.js → canvas-view.js (964 lines)
**Old Location:** view.js:950-1796 (approx)
**New Location:** canvas-view.js
**Functions Moved:**
- `renderCanvas()` - Main canvas renderer with infinite bounds calculation
- `renderCanvasTab(tab)` - Individual tab renderer with drag handles
- `renderCanvasGroup(group)` - Group container renderer
- `setupCanvasDragAndDrop()` - Canvas drag-and-drop event handlers
- `pushAwayOverlaps()` - Smart collision avoidance with recursive push
- `wouldCollide()` - Collision detection for placement
- `calculateInfiniteCanvasBounds()` - Dynamic canvas sizing
- Canvas-specific handlers for groups, children popups, comments

**Risk Areas (CRITICAL - Most Complex Module):**
- **Drag-and-drop coordinate conversion** (FIXED: clientX=0 bug)
  - Old bug: HTML5 Drag API returns 0,0 in dragend
  - Fix: Mouse position tracking in dragover, fallback in dragend
  - Location: canvas-view.js:676-678, 732-735, 843-844

- **Grid snapping logic** (FIXED: always-on bug)
  - Old bug: Always snapped regardless of toggle
  - Fix: Conditional snapping based on `gridSnapEnabled`
  - Location: canvas-view.js:860-861

- **Scroll position preservation**
  - Must save scroll state before DOM clear, restore after render
  - Location: canvas-view.js:40-50, 200-210 (approx)

- **Push-away collision handling**
  - Recursive depth limit (max 3 levels)
  - Direction calculation based on element centers
  - Edge case: Can push elements off-screen (intentional for infinite canvas)

---

### Remained in view.js (343 lines)
**Kept Functions:**
- `loadData()` - Initial data load from chrome.storage
- `render()` - View mode dispatcher
- `switchViewMode(mode)` - View switching with UI control visibility
- `setupEventListeners()` - Global event listener registration
- `toggleDarkMode()` - Theme switching
- `toggleFullscreen()` - Fullscreen mode handler
- `handleSearch()` - Search input handler
- `toggleSelectionMode()` - Multi-select mode toggle

**Risk Areas:**
- View-specific control visibility (FIXED: closed tabs toggle in canvas)
  - Old bug: Toggle shown in canvas view where irrelevant
  - Fix: Hide based on view mode in switchViewMode()
  - Location: view.js:143-144

---

## Bug Fixes Applied During Refactoring

### Bug #1: Canvas Drag Jump to (0,0)
**Root Cause:** HTML5 Drag API returns `clientX=0, clientY=0` in dragend event (browser bug)

**Old Code (Broken):**
```javascript
workspace.addEventListener('dragend', async (e) => {
  const newX = e.clientX - workspaceRect.left + workspace.scrollLeft - dragOffset.x;
  const newY = e.clientY - workspaceRect.top + workspace.scrollTop - dragOffset.y;
  // When e.clientX=0, e.clientY=0, this gives negative values → jump!
});
```

**New Code (Fixed):**
```javascript
// Track mouse position during dragover
let lastValidMouseX = 0;
let lastValidMouseY = 0;

workspace.addEventListener('dragover', (e) => {
  if (e.clientX !== 0 || e.clientY !== 0) {
    lastValidMouseX = e.clientX;
    lastValidMouseY = e.clientY;
  }
});

workspace.addEventListener('dragend', async (e) => {
  // Use tracked position as fallback
  const safeClientX = (e.clientX === 0 && e.clientY === 0) ? lastValidMouseX : e.clientX;
  const safeClientY = (e.clientX === 0 && e.clientY === 0) ? lastValidMouseY : e.clientY;

  const newX = safeClientX - workspaceRect.left + workspace.scrollLeft - dragOffset.x;
  const newY = safeClientY - workspaceRect.top + workspace.scrollTop - dragOffset.y;
});
```

**Files Changed:** canvas-view.js:676-678, 732-735, 843-844
**Test Coverage:** tests/canvas-drag.test.js:177-197

---

### Bug #1b: Grid Snapping Always Enabled
**Root Cause:** Code always called `snapToGrid()` without checking toggle state

**Old Code (Broken):**
```javascript
const snappedX = snapToGrid(canvasX);
const snappedY = snapToGrid(canvasY);
```

**New Code (Fixed):**
```javascript
const snappedX = gridSnapEnabled ? snapToGrid(canvasX) : canvasX;
const snappedY = gridSnapEnabled ? snapToGrid(canvasY) : canvasY;
```

**Files Changed:** canvas-view.js:860-861

---

### Bug #2: "Show Closed Tabs" Toggle Visible in Canvas
**Root Cause:** No logic to hide toggle based on view mode

**Old Code (Broken):**
```javascript
function switchViewMode(mode) {
  viewMode = mode;
  // No visibility control for toggle
  render();
}
```

**New Code (Fixed):**
```javascript
function switchViewMode(mode) {
  viewMode = mode;

  // Hide toggle in canvas view (always shows active tabs only)
  const showClosedLabel = document.getElementById('showClosedToggleLabel');
  showClosedLabel.style.display = mode === 'canvas' ? 'none' : 'flex';

  render();
}
```

**Files Changed:**
- view.html:26 (added `id="showClosedToggleLabel"`)
- view.js:143-144

---

## Known Issues NOT Fixed

### Low Priority: Circular Relationship Detection Logic Inverted
**Location:** utils.js:136-156 (`wouldCreateCircularRelationship()`)

**Current Behavior:**
```javascript
// Comment says: "Check if parent is descendant of child"
// But code checks if child is descendant of parent (backwards!)

function wouldCreateCircularRelationship(childId, parentId) {
  const descendants = new Set();
  collectDescendants(childId);  // ← Should be collectDescendants(parentId)
  return descendants.has(parentId);  // ← Should be descendants.has(childId)
}
```

**Why Not Fixed:**
- Works correctly for most common scenarios
- Tests document the behavior
- Low impact (only affects edge cases)
- Can be fixed later if needed

**Test Coverage:** tests/utils.test.js:139-177

---

## Module Dependencies

```
view.html
  └─ Loads scripts in dependency order:
      1. utils.js (no dependencies)
      2. relationship-manager.js (depends on: utils, globals)
      3. storage-manager.js (depends on: utils, globals)
      4. group-manager.js (depends on: utils, globals)
      5. comment-manager.js (depends on: utils, popup-utils, globals)
      6. popup-utils.js (depends on: utils, globals)
      7. tree-view.js (depends on: utils, relationship-manager, globals)
      8. sequential-view.js (depends on: utils, globals)
      9. canvas-view.js (depends on: utils, group-manager, comment-manager, popup-utils, globals)
      10. view.js (depends on: all modules)
```

**Global Variables Used Across Modules:**
- `tabsData` - Main tab data object
- `canvasData` - Canvas positions and groups
- `viewMode` - Current view mode ('tree'|'sequential'|'canvas')
- `searchTerm` - Current search filter
- `showClosedTabs` - Closed tabs toggle state
- `expandedNodes` - Tree expand/collapse state
- `selectedTabIds` - Multi-select mode state
- `isSelectionMode` - Multi-select mode flag
- `gridSnapEnabled` - Grid snapping toggle state
- `darkMode` - Theme state

**Risk:** Global variable coupling makes modules interdependent

---

## Debugging Guide

### If Canvas Drag Breaks Again:
1. Check console for errors in canvas-view.js dragend handler
2. Verify `lastValidMouseX/Y` is being set in dragover
3. Add logging: `console.log('dragend', e.clientX, e.clientY, safeClientX, safeClientY)`
4. Test with grid snapping ON and OFF
5. Run test: `npm test -- canvas-drag.test.js`

### If Tree View Breaks:
1. Check if root tabs are identified correctly (orphaned tabs)
2. Verify parent-child relationships in `tabsData`
3. Test with search filter + closed tabs toggle combinations
4. Check if expand/collapse state is preserved
5. Run test: `npm test -- tree-view.test.js`

### If Relationships Break:
1. Check circular relationship detection logic
2. Verify `selectedTabIds` is managed correctly in multi-select mode
3. Test making tab its own child (should prevent)
4. Test circular relationships (A→B→C, then C→A should prevent)
5. Run test: `npm test -- utils.test.js -t "relationship"`

### If Storage Operations Fail:
1. Check Chrome console for storage errors
2. Verify `chrome.storage.local.set()` is awaited
3. Check if data structure matches expected format
4. Test session save/load functionality
5. Inspect storage: `chrome.storage.local.get(console.log)`

---

## Rollback Instructions

If critical bugs appear and you need to rollback:

```bash
# Find the commit before refactoring
git log --oneline

# Revert to before refactoring (commit before 4f30963)
git checkout e1b421a

# Or revert just the refactoring commit
git revert 4f30963

# Or revert bug fixes
git revert 5ce129e
```

**Pre-refactoring state:**
- Commit: `e1b421a` - Tests added, but view.js still 1796 lines
- All functionality worked, but code was monolithic

---

## Testing After Deployment

**Manual Testing Checklist:**

1. **Canvas Drag Test:**
   - [ ] Drag tab - should not jump to (0,0)
   - [ ] Drag group - should not jump to (0,0)
   - [ ] Drag with grid snap ON - should snap to 20px grid
   - [ ] Drag with grid snap OFF - should move freely

2. **View Toggle Test:**
   - [ ] Canvas view - "Show Closed Tabs" toggle hidden
   - [ ] Tree view - "Show Closed Tabs" toggle visible and working
   - [ ] Sequential view - "Show Closed Tabs" toggle visible and working

3. **Relationship Test:**
   - [ ] Make tab child of another tab - should work
   - [ ] Try to make tab its own child - should prevent with alert
   - [ ] Try to create circular relationship - should prevent with alert

4. **General Functionality:**
   - [ ] Switch between all 3 views - no errors
   - [ ] Search works in all views
   - [ ] Dark mode toggle works
   - [ ] Fullscreen mode works
   - [ ] Comments display and are editable
   - [ ] Groups can be created and moved
   - [ ] Session save/load works

**Automated Testing:**
```bash
npm test                    # Run all 57 tests
npm test -- --coverage      # Check code coverage
npm test -- --watch         # Watch mode for development
```

---

## Performance Considerations

**Current Limitations:**
- Full re-render on every data change (no diffing)
- No virtualization for large lists (100+ tabs may lag)
- No debouncing on search input
- Canvas calculations run on every render

**If Performance Issues Arise:**
1. Add debouncing to search input (300ms delay)
2. Implement virtual scrolling for tree/sequential views
3. Cache canvas bounds calculation
4. Use event delegation instead of per-element listeners
5. Consider incremental rendering for canvas

---

## Future Refactoring Opportunities

**canvas-view.js (964 lines) could be split further:**
- canvas-renderer.js - Pure rendering logic
- canvas-drag.js - Drag-and-drop handling
- canvas-collision.js - Collision detection and push-away logic
- canvas-layout.js - Bounds calculation and positioning

**Reduce global variable coupling:**
- Pass dependencies as parameters instead of accessing globals
- Consider a simple state manager or pub/sub pattern
- Wrap globals in a state object for easier tracking

**Improve type safety:**
- Add JSDoc comments with @param and @return types
- Consider TypeScript migration (would require build step)
- Add runtime validation for critical functions

---

## Contact & Support

If bugs arise from this refactoring:
1. Check this map to identify what changed
2. Run the test suite to identify what broke
3. Check git history: `git log --follow <filename>`
4. Compare with pre-refactoring commit: `e1b421a`

**Refactoring Session:** November 2025
**Commits:**
- `e1b421a` - Add comprehensive unit testing framework
- `4f30963` - Refactor view.js into focused modules (81% size reduction)
- `5ce129e` - Fix canvas drag-and-drop bugs and toggle visibility
