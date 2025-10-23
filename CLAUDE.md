# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tab Journey Visualizer is a Microsoft Edge/Chrome extension (Manifest V3) that visualizes tab relationships in multiple view modes:
- **Tree View**: Hierarchical parent-child relationships with expand/collapse
- **Sequential View**: Chronological timeline of tab history
- **Canvas View**: Infinite 2D workspace with drag-and-drop and smart grouping

It tracks when tabs are opened from other tabs (parent-child relationships) and provides interactive tools for organizing and understanding your browsing journey.

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

Data stored in `chrome.storage.local`:

```javascript
{
  // Tab data (flat structure)
  tabs: {
    [tabId]: {
      id: number,          // Tab ID
      title: string,       // Page title
      url: string,         // Page URL
      parentId: number,    // Parent tab ID (or null for root tabs)
      timestamp: number,   // Creation timestamp
      active: boolean,     // Whether tab is currently open
      favIconUrl: string   // Favicon URL
    }
  },

  // Canvas layout data
  canvasData: {
    positions: {
      [tabId]: { x: number, y: number }  // Tab positions on canvas
    },
    groups: {
      [groupId]: {
        id: string,                      // Group ID (e.g., "group_1234567890")
        name: string,                    // Group name
        color: string,                   // Hex color code
        tabs: number[],                  // Array of tab IDs in this group
        position: {
          x: number,
          y: number,
          width: number,
          height: number
        }
      }
    }
  },

  // User preferences
  darkMode: boolean  // Dark mode enabled/disabled
}
```

**Group ID Patterns:**
- Manual groups: `group_timestamp` (2 parts)
- Auto-groups: `group_timestamp_index` (3 parts) - created by domain grouping

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

### Canvas View - Infinite 2D Workspace

**Infinite Canvas:**
- No boundary checks - elements can be positioned anywhere
- Canvas workspace uses `overflow: auto` for scrolling
- Scroll position is preserved during re-renders using saved state

**Drag and Drop:**
- HTML5 Drag API (`dragstart`, `dragover`, `dragend`)
- Grid snapping optional (20px grid)
- Position saved on `dragend` event

**Smart Push-Away Collision Handling:**
```javascript
pushAwayOverlaps(type, id, newX, newY, width, height, depth)
```
- Recursively pushes overlapping elements in the optimal direction
- Depth limited to 3 levels to prevent infinite loops
- Direction calculated by comparing element centers
- Minimal push distances based on actual overlap + margin

**Children Indicators:**
- Tabs with children show a dot (●) indicator
- Click opens a popup showing all descendants hierarchically
- Popup positioned to stay on-screen

### Grouping System

**Manual Groups:**
- Created via "Create Group" button
- ID format: `group_timestamp`
- User-defined names and positions
- Tabs added via context menu (right-click)

**Auto-Groups:**
- Created by "Auto-Group by Domain" feature
- ID format: `group_timestamp_index`
- Named after domain (capitalized)
- Only groups tabs not already in manual groups
- Preserves manual groups when re-grouping

**Group Features:**
- Drag group → all contained tabs move with it
- Groups auto-size based on active tab count (2-column layout)
- Context menu with searchable group list (when >5 groups)
- "Clear Auto-Groups" button removes only auto-generated groups

### View Modes

**Tree View:**
- Hierarchical display with expand/collapse
- Multi-select mode for manual parent-child assignment
- Shows both active and closed tabs
- Click active tab to switch to it

**Sequential View:**
- Chronological timeline
- Sortable by newest/oldest first
- Shows both active and closed tabs

**Canvas View:**
- Shows ONLY active tabs (closed tabs excluded)
- Infinite scrolling workspace
- Fullscreen mode available (hides header/controls)
- Real-time scroll position preservation

### Storage Persistence

- Uses `chrome.storage.local` (not `sessionStorage`)
- Data persists across browser restarts
- Canvas positions and groups included in session save/load
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

## Completed Major Features

- ✅ Canvas drag-and-drop view with infinite scrolling
- ✅ Smart push-away collision handling
- ✅ Tab grouping (manual and auto-domain)
- ✅ Session management with canvas state
- ✅ Dark mode theme
- ✅ Fullscreen canvas mode
- ✅ Multi-select parent-child editing
- ✅ Children popup indicators
- ✅ Scroll position preservation

## Future Enhancement Considerations

Potential features for future versions:
- Relationship-based auto-grouping using parent-child tree data
- Tab control (close, move tabs directly from visualizer)
- Statistics and analytics dashboard
- Additional visual themes
- Keyboard shortcuts for common actions
- Semantic/AI-powered grouping for large tab sets
- Undo/redo for canvas operations
- Minimap for large canvases

When implementing new features, maintain:
- Simple, readable code
- Comprehensive comments
- Vanilla JS approach (no build step)
- Backward compatibility with existing storage structure

## Important Notes for AI Assistants

**Canvas View Specifics:**
- Canvas shows ONLY active tabs (closed tabs filtered out)
- Infinite canvas - no boundary checks in push-away logic
- Scroll position must be preserved on re-render
- Group IDs determine if auto-generated (3 parts) or manual (2 parts)

**Common Pitfalls:**
- Don't add bounds checking to canvas - it's intentionally infinite
- Don't show closed tabs in canvas view
- Preserve manual groups when auto-grouping
- Always save scroll position before clearing container
- Grid snap is optional, not mandatory
