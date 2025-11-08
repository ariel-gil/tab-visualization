// Test setup - Mock Chrome APIs and global state

// Mock Chrome Storage API
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const mockData = {
          tabs: {},
          canvasData: {
            positions: {},
            groups: {},
            comments: {}
          },
          darkMode: false
        };

        if (callback) {
          callback(mockData);
        }
        return Promise.resolve(mockData);
      }),
      set: jest.fn((data, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      })
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  tabs: {
    get: jest.fn((tabId, callback) => {
      const mockTab = {
        id: tabId,
        windowId: 1,
        title: 'Test Tab',
        url: 'https://example.com',
        active: true
      };
      if (callback) {
        callback(mockTab);
      }
      return Promise.resolve(mockTab);
    }),
    query: jest.fn((query, callback) => {
      const mockTabs = [{
        id: 1,
        windowId: 1,
        title: 'Test Tab',
        url: 'https://example.com',
        active: true
      }];
      if (callback) {
        callback(mockTabs);
      }
      return Promise.resolve(mockTabs);
    }),
    update: jest.fn((tabId, updateInfo, callback) => {
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    onCreated: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn()
    }
  },
  windows: {
    update: jest.fn((windowId, updateInfo, callback) => {
      if (callback) {
        callback();
      }
      return Promise.resolve();
    })
  }
};

// Mock DOM elements that are needed for tests
document.body.innerHTML = `
  <div class="container">
    <div id="treeContainer"></div>
    <div id="canvasWorkspace"></div>
  </div>
`;

// Helper function to create mock tab data
global.createMockTab = (id, overrides = {}) => ({
  id,
  title: `Tab ${id}`,
  url: `https://example.com/page${id}`,
  parentId: null,
  timestamp: Date.now(),
  active: true,
  favIconUrl: `https://example.com/favicon${id}.ico`,
  comment: '',
  ...overrides
});

// Helper function to create mock tabs data structure
global.createMockTabsData = (tabs) => {
  const tabsData = {};
  tabs.forEach(tab => {
    tabsData[tab.id] = tab;
  });
  return tabsData;
};

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
