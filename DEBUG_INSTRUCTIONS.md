# Debugging Instructions for Tab Journey Visualizer

## Setup

1. Reload the extension in Edge: `edge://extensions/` → click the refresh icon
2. Open the Tab Journey Visualizer (click the extension icon)
3. Open the Developer Console (F12) on the visualizer tab

## Issue 1: Context Menu Not Showing in Fullscreen

### How to Test:
1. Switch to **Canvas View**
2. Click the **⛶ Fullscreen** button to enter fullscreen mode
3. Try to click the **⋯** menu button on any tab card
4. Check the console for debug output

### Expected Console Output:
```
=== showTabContextMenu called ===
TabId: [number] Position: [x] [y]
Is fullscreen? true
Menu element created
Menu appended to body
Menu positioned at: [x] [y]
Menu rect: DOMRect { ... }
Menu computed style z-index: 10001
Menu element in DOM? true
```

### What to Look For:
- Does `showTabContextMenu` get called at all?
- Is `Is fullscreen?` showing `true`?
- What is the `Menu computed style z-index`? (should be 10001)
- Is `Menu element in DOM?` returning `true`?
- After the menu is created, open the Elements inspector (in DevTools) and search for `canvas-context-menu` - is it in the DOM? What are its actual styles?

### Possible Issues:
- Menu might be positioned off-screen
- Menu might have wrong z-index
- Click event might not be firing in fullscreen mode

---

## Issue 2: Comment Bubble Not Appearing

### How to Test:
1. Make sure you're in **Canvas View**
2. Click the **⋯** menu on any tab
3. Click **💬 Add Comment**
4. Type a comment (e.g., "Test comment")
5. Click **Save**
6. Check the console for debug output

### Expected Console Output:
```
=== Saving tab comment ===
Tab ID: [number]
Comment text: Test comment
Trimmed comment: Test comment
Comment saved to tab object: Test comment
Tab object: { id: ..., comment: "Test comment", ... }
Saved to storage. Tab in tabsData: { id: ..., comment: "Test comment", ... }
Current view mode: canvas
Render complete

=== renderCanvas called ===
Tabs with comments: [{ id: ..., title: ..., comment: "Test comment" }]

Checking comment for tab [number]: Test comment
✓ Creating comment indicator for tab [number]
Comment indicator appended to tabDiv
Indicator styles: { position: "", className: "canvas-tab-comment-indicator", textContent: "💬" }
```

### What to Look For:
- Is the comment being saved? (check "Comment saved to tab object")
- Is the comment present after storage save? (check "Tab in tabsData")
- Does `renderCanvas` show tabs with comments?
- Is the comment indicator being created? (look for "✓ Creating comment indicator")
- After rendering, inspect the tab card element in DevTools - is there a div with class `canvas-tab-comment-indicator`?

### Possible Issues:
- Comment not saving to storage properly
- Storage change listener might be reloading data and losing the comment
- Comment indicator might be created but not visible (CSS issue)
- `tabsData` might not be properly updated

---

## Manual Inspection

### Check Storage Directly:
In the console, run:
```javascript
chrome.storage.local.get('tabs', (result) => {
  console.log('Tabs in storage:', result.tabs);
  // Find tabs with comments
  Object.entries(result.tabs).forEach(([id, tab]) => {
    if (tab.comment) {
      console.log('Tab', id, 'has comment:', tab.comment);
    }
  });
});
```

### Check If Indicator Exists in DOM:
After saving a comment, run:
```javascript
document.querySelectorAll('.canvas-tab-comment-indicator').forEach(el => {
  console.log('Indicator found:', el);
  console.log('Computed styles:', window.getComputedStyle(el));
  console.log('Bounding rect:', el.getBoundingClientRect());
});
```

### Check Menu in Fullscreen:
After clicking the menu button in fullscreen, run:
```javascript
const menu = document.querySelector('.canvas-context-menu');
if (menu) {
  console.log('Menu exists:', menu);
  console.log('Menu styles:', window.getComputedStyle(menu));
  console.log('Menu position:', menu.getBoundingClientRect());
  console.log('Is visible?', menu.offsetParent !== null);
} else {
  console.log('Menu not found in DOM');
}
```

---

## Report Back

Please provide:
1. All console output from the tests above
2. Screenshots of what you see (or don't see)
3. Results from the manual inspection commands
4. Browser version: Edge version number

This will help identify exactly where the issue is occurring.
