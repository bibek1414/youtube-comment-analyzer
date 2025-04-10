// background.js
chrome.runtime.onInstalled.addListener(function() {
    console.log('YouTube Comment Analyzer extension installed');
    
    // Initialize default settings if not already set
    chrome.storage.sync.get(['apiUrl', 'maxComments', 'autoAnalyze', 'chartType', 'theme'], function(items) {
      const defaults = {
        apiUrl: items.apiUrl || 'http://localhost:8000',
        maxComments: items.maxComments || 100,
        autoAnalyze: items.autoAnalyze !== undefined ? items.autoAnalyze : false,
        chartType: items.chartType || 'pie',
        theme: items.theme || 'light'
      };
      
      chrome.storage.sync.set(defaults);
    });
  });
  
  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getVideoInfo') {
      sendResponse({ videoId: request.videoId, videoTitle: request.videoTitle });
    }
  });
  
  