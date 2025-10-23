# Tab Journey Visualizer

A Microsoft Edge / Chrome extension that visualizes tab relationships and browsing history in an interactive tree view. See how your tabs are connected when opened via hyperlinks or from other tabs.

## Features

- **Multiple View Modes**: Tree view (hierarchical relationships), Sequential view (chronological timeline), and Canvas view (2D spatial organization)
- **Tab Relationship Tracking**: Automatically tracks parent-child relationships when tabs are opened
- **2D Canvas View**: Drag and drop tabs anywhere on a canvas with full X/Y movement
- **Smart Grouping**: Auto-group tabs by domain or create custom groups
- **Active/Closed Status**: See which tabs are currently open vs. closed
- **Search & Filter**: Quickly find tabs by title or URL
- **Data Export**: Export your tab history as JSON
- **Persistent Storage**: Tab data survives browser restarts
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
- **view.js** - Logic for rendering the tree and handling interactions
- **icon16.png, icon48.png, icon128.png** - Extension icons

### Helper Files

- **generate-icons.html** - Browser-based tool to create custom icons
- **create-icons.js** - Node.js script to generate icons (optional)

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

The Canvas View provides a free-form 2D workspace where you can spatially organize your tabs:

**Navigation:**
- Switch to Canvas View using the tab selector at the top
- Drag any tab card to move it anywhere on the canvas (full X/Y movement)
- Toggle "Grid Snap" to snap tabs to a 20px grid for easier alignment

**Grouping Strategies:**

**Currently Available:**

1. **Manual Grouping** (Best for: 5-20 tabs)
   - Click "Create Group" to make a new colored group box
   - Right-click any tab and select "Add to [Group Name]"
   - Perfect when you know exactly what goes together
   - Full control over organization

2. **Domain-Based Auto-Grouping** (Best for: Multiple tabs from same sites)
   - Click "Auto-Group by Domain" in Canvas View
   - Automatically creates groups for sites with 2+ tabs
   - Example: 10 GitHub tabs, 8 YouTube tabs → instant organized groups
   - Tabs from unique domains remain ungrouped

**Future Grouping Ideas (Not Yet Implemented):**

These are potential approaches being considered as the project evolves:

3. **Relationship-Based Grouping** (Concept)
   - Group tabs based on parent-child relationships already tracked
   - "This tab and all its children" in one group
   - "Group this entire browsing journey"
   - Would leverage existing tree structure data

4. **Session/Time-Based Grouping** (Concept)
   - "Tabs opened within 5 minutes of each other"
   - "Tabs from this morning vs afternoon"
   - Good for: "What was I working on earlier?"

5. **Semantic/AI Grouping** (Concept)
   - Only useful when you have 50+ tabs from different domains
   - "These 15 tabs across 8 domains are all about vacation planning"
   - Could use local LLM or API call
   - Worth the added complexity when manual grouping becomes overwhelming

**Philosophy:** Manual grouping should stay easy for small sets. Smart grouping is for when you're drowning in tabs and need help making sense of the chaos.

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
├── view.js               # UI logic
├── icon16.png            # Small icon
├── icon48.png            # Medium icon
├── icon128.png           # Large icon
├── generate-icons.html   # Icon generator
├── create-icons.js       # Icon script
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

## Future Enhancements

Potential features for future versions:
- ✅ Drag-and-drop canvas view with 2D movement (completed)
- ✅ Tab grouping with auto-group by domain (completed)
- Relationship-based auto-grouping using parent-child tree data
- Tab control (close, move, group tabs directly from visualizer)
- Enhanced session management (save and restore with canvas layouts)
- Statistics and analytics
- Visual themes
- Keyboard shortcuts
- Semantic/AI-powered grouping for large tab sets

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
