// Warpreader Extension — Background Service Worker

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
      chrome.action.openPopup().catch(() => {
        // openPopup can fail in some contexts; that's fine
      });
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ARTICLE_TEXT') {
    chrome.storage.local.set({ pendingText: msg.text, pendingTitle: msg.title });
  }

  if (msg.type === 'OPEN_READER') {
    // Store text and open the full reader tab
    const payload = { readerWords: msg.text };
    if (msg.idx !== undefined) payload.readerIdx = msg.idx;
    if (msg.wpm !== undefined) payload.readerWPM = msg.wpm;
    chrome.storage.local.set(payload, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
    });
  }
});
