// Background service worker for Tailor extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Tailor installed');
});

// Handle any background tasks if needed
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return false;
});
