# Tab Journey Visualizer

A Microsoft Edge / Chrome extension that visualizes tab relationships and browsing history in an interactive tree view. See how your tabs are connected when opened via hyperlinks or from other tabs.

## Features

- **Multiple View Modes**: Tree view (hierarchical relationships), Sequential view (chronological timeline), and Canvas view (2D spatial organization with infinite scrolling)
- **Tab Relationship Tracking**: Automatically tracks parent-child relationships when tabs are opened
- **Drag-to-Parent**: In Canvas view, drag a tab onto another to make it a child (with visual feedback)
- **Tab Comments**: Add notes to any tab via context menu (💬 indicator shows tabs with comments)
- **Infinite 2D Canvas**: Drag and drop tabs anywhere with automatic push-away of overlapping elements - no boundaries
- **Smart Grouping**: Auto-group tabs by domain or create custom groups with visual organization
- **Children Popup**: Click the dot (●) on any parent tab to see all children in a hierarchical popup
- **Fullscreen Canvas Mode**: Immersive fullscreen view with minimizable controls (press ESC to exit)
- **Dark Mode**: Built-in dark theme that works on extension pages
- **Active Tabs Only**: Canvas view shows only open tabs for cleaner organization
- **Search & Filter**: Quickly find tabs by title or URL with live filtering
- **Session Management**: Save and load sessions with canvas layouts, groups, and preferences
- **Multi-Select**: Manually create parent-child relationships in Tree view
- **Data Export**: Export your tab history as JSON with full canvas state
- **Persistent Storage**: Tab data, positions, groups, and comments survive browser restarts
- **Real-time Updates**: Visualization updates automatically as you browse

## Installation

### Load as Unpacked Extension

1. **Open Edge Extensions Page**
   - Open Microsoft Edge
   - Navigate to `edge://extensions/`
   - Or go to Menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" ON in the bottom left corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to the `tab-visualization` folder
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "Tab Journey Visualizer" in your extensions list
   - The extension icon should appear in your toolbar

### Usage

1. **Open the Visualizer**
   - Click the extension icon in your toolbar
   - This will open the visualization in a new tab

2. **Pin the Tab (Recommended)**
   - Right-click on the visualization tab
   - Select "Pin tab"
   - This keeps the visualizer accessible and prevents accidental closing

3. **Browse Normally**
   - Open new tabs by clicking links or using Ctrl+T
   - The extension automatically tracks all tab relationships
   - The visualization updates in real-time

4. **View Your Journey**
   - Root tabs (tabs with no parent) are highlighted in orange
   - Active tabs have a green "ACTIVE" badge
   - Closed tabs have a red "CLOSED" badge and are slightly faded
   - Children are indented under their parent tabs

## Files Overview

### Core Extension Files

- **manifest.json** - Extension configuration (Manifest V3)
- **background.js** - Service worker that tracks tab events
- **view.html** - Main visualization page
- **view.css** - Styling for the visualization
- **view.js** - Main application logic and rendering (1792 lines)
- **icon16.png, icon48.png, icon128.png** - Extension icons

### Modular Architecture (Refactored Jan 2025)

The codebase has been refactored into focused modules for better maintainability:

- **utils.js** (171 lines) - Common utilities, DOM helpers, collision detection
- **storage-manager.js** (145 lines) - Session save/load, browser sync, storage operations
- **group-manager.js** (343 lines) - Group creation, auto-grouping, tab-group operations
- **comment-manager.js** (291 lines) - Canvas and tab comment management
- **popup-utils.js** (160 lines) - Children popup, context menus, menu builders

**Benefits:** 37% code reduction, eliminated duplication, single responsibility per module

### Helper Files

- **generate-icons.html** - Browser-based tool to create custom icons
- **create-icons.js** - Node.js script to generate icons (optional)
- **CLAUDE.md** - Detailed technical documentation for AI assistants

## How It Works

### Background Service Worker (background.js)

The service worker runs in the background and listens for tab events:

- **chrome.tabs.onCreated**: Captures when new tabs are created and stores the parent tab ID (`openerTabId`)
- **chrome.tabs.onUpdated**: Updates tab titles and URLs as pages load
- **chrome.tabs.onRemoved**: Marks tabs as inactive when closed (preserves history)

All data is stored in `chrome.storage.local` which persists across browser sessions.

### Data Structure

Each tab is stored with the following information:

```javascript
{
  id: number,          // Unique tab ID
  title: string,       // Page title
  url: string,         // Page URL
  parentId: number,    // ID of parent tab (or null for root tabs)
  timestamp: number,   // When the tab was created
  active: boolean      // Whether tab is currently open
}
```

### Visualization (view.html/css/js)

The visualization:
1. Loads tab data from `chrome.storage.local`
2. Builds a tree structure by linking children to parents
3. Renders the tree with proper indentation and styling
4. Updates automatically when storage changes

## Features in Detail

### Search & Filter

Type in the search box to filter tabs by title or URL. The tree view updates instantly.

### Export Data

Click "Export JSON" to download your entire tab history as a JSON file. Useful for:
- Backing up browsing sessions
- Analyzing browsing patterns
- Transferring data between browsers

### Clear History

Click "Clear History" to delete all tracked tabs. This action cannot be undone. Active tabs will be re-tracked immediately.

### Canvas View & Grouping

The Canvas View provides an infinite 2D workspace where you can spatially organize your tabs:

**Navigation:**
- Switch to Canvas View using the tab selector at the top
- Drag any tab or group anywhere on the infinite canvas (full X/Y movement)
- Overlapping elements automatically push away to make room
- Toggle "Grid Snap" to snap tabs to a 20px grid for easier alignment
- Press "⛶ Fullscreen" for an immersive distraction-free view (ESC to exit)

**Canvas Features:**
- **Infinite Canvas**: No boundaries - elements can be positioned anywhere
- **Smart Push-Away**: Dragging over other elements automatically moves them aside
- **Active Tabs Only**: Canvas only shows open tabs for cleaner organization
- **Children Indicators**: Tabs with children show a dot (●) - click to view in a popup
- **Scroll Position Memory**: Your scroll position is preserved when making changes

**Grouping:**

1. **Manual Grouping**
   - Click "➕ Create Group" to make a new colored group box
   - Right-click any tab and select "Add to [Group Name]"
   - Groups expand automatically to fit tabs in a 2-column layout
   - Drag groups to move all contained tabs together
   - Delete groups (tabs remain on canvas) or remove tabs from groups

2. **Domain-Based Auto-Grouping**
   - Click "🤖 Auto-Group by Domain" in Canvas View
   - Automatically creates groups for sites with 2+ tabs
   - **Preserves manual groups** - only groups ungrouped tabs
   - Example: 10 GitHub tabs, 8 YouTube tabs → instant organized groups
   - Groups stack vertically on the left, ungrouped tabs on the right

3. **Clear Auto-Groups**
   - Click "🧹 Clear Auto-Groups" to remove only auto-generated groups
   - Manual groups are preserved
   - Useful for re-organizing after changes

**Grouping Features:**
- Searchable group list when adding tabs (appears when >5 groups)
- Groups sized dynamically based on active tab count
- Color-coded groups for easy identification
- Context menu for quick tab organization

## Customization

### Custom Icons

To create custom icons for the extension:

1. **Option 1: Browser-based (easiest)**
   - Open `generate-icons.html` in your browser
   - Click the download buttons for each icon size
   - Save the icons to the extension folder

2. **Option 2: Node.js script**
   - Install dependencies: `npm install canvas`
   - Run: `node create-icons.js`
   - Icons will be generated automatically

### Modify Styling

Edit `view.css` to customize:
- Colors (root tabs, active/closed badges)
- Spacing and indentation
- Font sizes and styles

## Troubleshooting

### Extension doesn't load
- Make sure Developer mode is enabled in `edge://extensions/`
- Check that all required files are present in the folder
- Look for errors in the Extensions page

### Tabs not being tracked
- Open the Extension page (`edge://extensions/`)
- Click "Service worker" next to the extension to view logs
- Check for JavaScript errors

### Visualization not updating
- Click the "Refresh" button in the visualization
- Check that the background service worker is running
- Reload the visualization tab

### Missing icons
- Icons are required for the extension to load
- Use `generate-icons.html` or `create-icons.js` to create them
- Or replace with your own 16x16, 48x48, and 128x128 PNG files

## Development

This extension uses vanilla JavaScript for simplicity and maintainability. No build process or frameworks required.

### File Structure
```
tab-visualization/
├── manifest.json          # Extension config
├── background.js          # Service worker
├── view.html             # Main UI
├── view.css              # Styles
├── view.js               # Main application logic (1792 lines)
├── utils.js              # Common utilities (171 lines)
├── storage-manager.js    # Storage operations (145 lines)
├── group-manager.js      # Group management (343 lines)
├── comment-manager.js    # Comment features (291 lines)
├── popup-utils.js        # Popup helpers (160 lines)
├── icon16.png            # Small icon
├── icon48.png            # Medium icon
├── icon128.png           # Large icon
├── generate-icons.html   # Icon generator
├── create-icons.js       # Icon script
├── CLAUDE.md             # Technical docs
└── README.md             # This file
```

### Testing

1. Make code changes
2. Go to `edge://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

### Debugging

- **Background worker**: Click "Service worker" in Extensions page
- **Visualization**: Press F12 in the visualization tab
- **Storage**: Check `edge://extensions/` → Extension details → Storage

## Completed Features

- ✅ Drag-and-drop canvas view with infinite 2D movement
- ✅ Tab grouping with auto-group by domain (preserves manual groups)
- ✅ Smart push-away collision handling
- ✅ Children popup indicators in canvas view
- ✅ Fullscreen canvas mode with working popups/menus
- ✅ Dark mode support
- ✅ Session save/load with canvas state
- ✅ Multi-select for manual parent-child relationships
- ✅ Scroll position preservation
- ✅ Active-only filtering in canvas view
- ✅ **Clickable comment bubbles (💬)** - Click to view/edit comments
- ✅ **Modular code architecture** - Clean, maintainable codebase

## Future Enhancement Ideas

Potential features for future versions:
- Relationship-based auto-grouping using parent-child tree data
- Tab control (close, move tabs directly from visualizer)
- Statistics and analytics dashboard
- Additional visual themes
- Keyboard shortcuts for common actions
- Semantic/AI-powered grouping for large tab sets
- Undo/redo for canvas operations
- Minimap for large canvases

## Privacy

This extension:
- ✅ Only stores data locally in your browser
- ✅ Does not send any data to external servers
- ✅ Does not track you or collect analytics
- ✅ Only accesses tab information (title, URL) necessary for functionality

## License

Free to use and modify for personal or educational purposes.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the code comments in the source files
3. Open an issue on the project repository

---

**Enjoy visualizing your browsing journey! 🌳**
