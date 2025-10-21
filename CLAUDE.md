# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tab Journey Visualizer is a Microsoft Edge/Chrome extension (Manifest V3) that visualizes tab relationships in a hierarchical tree view. It tracks when tabs are opened from other tabs (parent-child relationships) and displays the browsing journey in an interactive visualization.

## Extension Architecture

### Core Components

1. **manifest.json** - Manifest V3 extension configuration
   - Declares permissions: `tabs`, `storage`
   - Registers background service worker
   - Defines extension action (toolbar icon)

2. **background.js** - Service worker (background script)
   - Listens to tab events: `chrome.tabs.onCreated`, `onUpdated`, `onRemoved`
   - Captures parent-child relationships via `openerTabId` property
   - Stores tab data in `chrome.storage.local`
   - Opens visualization when extension icon is clicked

3. **view.html/css/js** - Full-page visualization interface
   - Loads tab data from storage
   - Builds tree structure from parent-child relationships
   - Renders interactive hierarchical view
   - Real-time updates via `chrome.storage.onChanged` listener

### Data Model

Tabs are stored as a flat object in `chrome.storage.local` with key `tabs`:

```javascript
{
  tabs: {
    [tabId]: {
      id: number,          // Tab ID
      title: string,       // Page title
      url: string,         // Page URL
      parentId: number,    // Parent tab ID (or null for root tabs)
      timestamp: number,   // Creation timestamp
      active: boolean      // Whether tab is currently open
    }
  }
}
```

### Tree Building Algorithm

The visualization converts the flat tab structure into a tree:
1. Filter tabs by search term (if any)
2. Identify root tabs (no parent or parent doesn't exist)
3. Recursively find children for each root tab
4. Render nodes with proper indentation

## Development Workflow

### Testing the Extension

1. **Load in Edge/Chrome**:
   ```
   - Navigate to edge://extensions/
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the tab-visualization folder
   ```

2. **Reload After Changes**:
   - Go to edge://extensions/
   - Click refresh icon on the extension card
   - Or use the reload button in the extension details

3. **View Logs**:
   - Background worker: Click "Service worker" in Extensions page
   - Visualization: Press F12 on view.html tab

### Debugging

- **Background service worker**: Console logs appear in Service Worker DevTools
- **Storage inspection**: Use `chrome.storage.local.get('tabs')` in console
- **Tab events**: Check console.log output in background.js for tab creation/update/removal

## Key Implementation Details

### Parent Tab Tracking

The critical property is `tab.openerTabId` from `chrome.tabs.onCreated` event. This identifies which tab opened the new tab (parent-child relationship).

### Storage Persistence

- Uses `chrome.storage.local` (not `sessionStorage`)
- Data persists across browser restarts
- Compatible with Edge's session restore feature

### Service Worker Lifecycle

- Manifest V3 uses service workers (not persistent background pages)
- Service worker may be suspended when inactive
- All state must be stored in `chrome.storage.local`, not in memory

### Real-time Updates

The visualization listens to `chrome.storage.onChanged` to automatically update when tabs are created/closed/updated without requiring manual refresh.

## Code Style

- Vanilla JavaScript (no frameworks/build tools required)
- Well-commented for beginner programmers (Python background)
- Prioritizes clarity and maintainability over optimization
- Modern ES6+ syntax (async/await, arrow functions, template literals)

## Future Enhancement Considerations

Phase 1 MVP is complete. Future phases mentioned in original requirements:
- Free-form canvas drag-and-drop view
- Tab control (close, move, group tabs from visualizer)
- Session management (save/restore browsing sessions)
- Visual themes and customization

When implementing new features, maintain:
- Simple, readable code
- Comprehensive comments
- Vanilla JS approach (no build step)
- Backward compatibility with existing storage structure
