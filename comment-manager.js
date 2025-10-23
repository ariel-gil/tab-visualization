// comment-manager.js - Handles canvas comments and tab comments
// Requires: canvasData, tabsData, saveCanvasData(), render(), isUpdatingStorage

// Create a new canvas comment
function createNewComment() {
  const commentId = 'comment_' + Date.now();
  const comment = {
    id: commentId,
    text: '',
    position: {
      x: 100,
      y: 100
    },
    timestamp: Date.now()
  };

  canvasData.comments[commentId] = comment;
  saveCanvasData();
  render();

  // Open the comment popup immediately for editing
  setTimeout(() => {
    showCommentPopup(commentId, true);
  }, 100);
}

// Show comment popup for canvas comment
function showCommentPopup(commentId, isNew = false) {
  const comment = canvasData.comments[commentId];
  if (!comment) return;

  // Remove any existing popup
  const existingPopup = document.querySelector('.canvas-comment-popup');
  if (existingPopup) existingPopup.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'canvas-comment-popup';

  // Header
  const header = createPopupHeader(isNew ? 'New Comment' : 'Comment', popup);
  popup.appendChild(header);

  // Content
  const content = document.createElement('div');
  content.className = 'canvas-comment-popup-content';

  const textarea = document.createElement('textarea');
  textarea.className = 'canvas-comment-textarea';
  textarea.value = comment.text || '';
  textarea.placeholder = 'Enter your comment...';
  content.appendChild(textarea);

  // Timestamp
  if (!isNew) {
    const timestamp = document.createElement('div');
    timestamp.className = 'canvas-comment-timestamp';
    timestamp.textContent = 'Created: ' + new Date(comment.timestamp).toLocaleString();
    content.appendChild(timestamp);
  }

  popup.appendChild(content);

  // Actions
  const actions = createCommentActions(comment, textarea, popup, isNew, () => deleteComment(commentId));
  popup.appendChild(actions);

  // Position popup at center of viewport
  positionPopupAtCenter(popup);

  // Focus textarea
  textarea.focus();

  // Close on click outside
  setupCommentClickOutside(popup, isNew, comment.id, () => deleteComment(commentId));
}

// Show comment popup for a tab
function showTabCommentPopup(tabId) {
  const tab = tabsData[tabId];
  if (!tab) return;

  // Remove any existing popup
  const existingPopup = document.querySelector('.canvas-comment-popup');
  if (existingPopup) existingPopup.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'canvas-comment-popup';

  // Header
  const header = createPopupHeader('Tab Comment', popup);
  popup.appendChild(header);

  // Tab info section
  const tabInfo = createTabInfoSection(tab);
  popup.appendChild(tabInfo);

  // Content
  const content = document.createElement('div');
  content.className = 'canvas-comment-popup-content';

  const textarea = document.createElement('textarea');
  textarea.className = 'canvas-comment-textarea';
  textarea.value = tab.comment || '';
  textarea.placeholder = 'Enter your comment for this tab...';
  content.appendChild(textarea);

  popup.appendChild(content);

  // Actions
  const actions = createTabCommentActions(tab, tabId, textarea, popup);
  popup.appendChild(actions);

  // Position popup at center of viewport
  positionPopupAtCenter(popup);

  // Focus textarea
  textarea.focus();

  // Close on click outside
  setupSimpleClickOutside(popup);
}

// Helper: Create popup header with close button
function createPopupHeader(titleText, popup) {
  const header = document.createElement('div');
  header.className = 'canvas-comment-popup-header';

  const title = document.createElement('span');
  title.className = 'canvas-comment-popup-title';
  title.textContent = titleText;
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'canvas-comment-popup-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    popup.remove();
  });
  header.appendChild(closeBtn);

  return header;
}

// Helper: Create tab info section
function createTabInfoSection(tab) {
  const tabInfo = document.createElement('div');
  tabInfo.style.marginBottom = '12px';
  tabInfo.style.padding = '8px';
  tabInfo.style.background = '#f8f9fa';
  tabInfo.style.borderRadius = '4px';
  tabInfo.style.fontSize = '12px';

  const tabTitle = document.createElement('div');
  tabTitle.style.fontWeight = '600';
  tabTitle.style.marginBottom = '4px';
  tabTitle.textContent = tab.title;
  tabInfo.appendChild(tabTitle);

  const tabUrl = document.createElement('div');
  tabUrl.style.color = '#666';
  tabUrl.style.overflow = 'hidden';
  tabUrl.style.textOverflow = 'ellipsis';
  tabUrl.style.whiteSpace = 'nowrap';
  tabUrl.textContent = tab.url;
  tabInfo.appendChild(tabUrl);

  return tabInfo;
}

// Helper: Create action buttons for canvas comment
function createCommentActions(comment, textarea, popup, isNew, deleteCallback) {
  const actions = document.createElement('div');
  actions.className = 'canvas-comment-popup-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    comment.text = textarea.value;
    saveCanvasData();
    popup.remove();
    render();
  });
  actions.appendChild(saveBtn);

  if (!isNew) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      if (confirm('Delete this comment?')) {
        deleteCallback();
        popup.remove();
      }
    });
    actions.appendChild(deleteBtn);
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    if (isNew && !comment.text) {
      // Delete empty new comment
      deleteCallback();
    }
    popup.remove();
  });
  actions.appendChild(cancelBtn);

  return actions;
}

// Helper: Create action buttons for tab comment
function createTabCommentActions(tab, tabId, textarea, popup) {
  const actions = document.createElement('div');
  actions.className = 'canvas-comment-popup-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    console.log('=== Saving tab comment ===');
    console.log('Tab ID:', tabId);
    console.log('Comment text:', textarea.value);
    const trimmedComment = textarea.value.trim();
    console.log('Trimmed comment:', trimmedComment);

    if (trimmedComment) {
      tab.comment = trimmedComment;
      console.log('Comment saved to tab object:', tab.comment);
      console.log('Tab object:', tab);
    } else {
      delete tab.comment; // Remove comment if empty
      console.log('Comment deleted (was empty)');
    }

    // Set flag to prevent storage listener from reloading
    isUpdatingStorage = true;
    await chrome.storage.local.set({ tabs: tabsData });
    console.log('Saved to storage. Tab in tabsData:', tabsData[tabId]);
    console.log('Current view mode:', viewMode);

    // Reset flag after a short delay to allow storage event to process
    setTimeout(() => {
      isUpdatingStorage = false;
    }, 100);

    popup.remove();
    render();
    console.log('Render complete');
  });
  actions.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    popup.remove();
  });
  actions.appendChild(cancelBtn);

  return actions;
}

// Helper: Position popup at center of viewport
function positionPopupAtCenter(popup) {
  document.body.appendChild(popup);
  const rect = popup.getBoundingClientRect();
  popup.style.left = `${(window.innerWidth - rect.width) / 2}px`;
  popup.style.top = `${(window.innerHeight - rect.height) / 2}px`;
}

// Helper: Setup click outside to close for canvas comment (with new comment deletion)
function setupCommentClickOutside(popup, isNew, commentId, deleteCallback) {
  const closeOnClickOutside = (e) => {
    if (!popup.contains(e.target)) {
      if (isNew && !canvasData.comments[commentId]?.text) {
        deleteCallback();
      }
      popup.remove();
      document.removeEventListener('click', closeOnClickOutside);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeOnClickOutside);
  }, 100);
}

// Helper: Setup simple click outside to close
function setupSimpleClickOutside(popup) {
  const closeOnClickOutside = (e) => {
    if (!popup.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeOnClickOutside);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeOnClickOutside);
  }, 100);
}

// Delete a canvas comment
function deleteComment(commentId) {
  delete canvasData.comments[commentId];
  saveCanvasData();
  render();
}

// Delete comment from tab
async function deleteTabComment(tabId) {
  if (!confirm('Delete this comment?')) return;

  const tab = tabsData[tabId];
  if (tab) {
    delete tab.comment;

    // Set flag to prevent storage listener from reloading
    isUpdatingStorage = true;
    await chrome.storage.local.set({ tabs: tabsData });

    // Reset flag after a short delay
    setTimeout(() => {
      isUpdatingStorage = false;
    }, 100);

    render();
  }
}
