// WarpRead Extension — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'speedread-selection',
    title: 'Speed Read This',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'speedread-selection' && info.selectionText) {
    chrome.storage.local.set({ pendingText: info.selectionText }, () => {
      chrome.action.openPopup();
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ARTICLE_TEXT') {
    chrome.storage.local.set({ pendingText: msg.text, pendingTitle: msg.title });
  }
});
