// content.js
(function() {
    // Check if we're on a YouTube video page
    if (window.location.href.includes('youtube.com/watch')) {
      // Get video ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      
      // Get video title
      const videoTitle = document.title.replace(' - YouTube', '');
      
      // Send information to background script
      chrome.runtime.sendMessage({
        action: 'getVideoInfo',
        videoId: videoId,
        videoTitle: videoTitle
      });
      
      // Check if auto-analyze is enabled
      chrome.storage.sync.get(['autoAnalyze'], function(items) {
        if (items.autoAnalyze) {
          // Send message to popup to trigger analysis
          chrome.runtime.sendMessage({
            action: 'analyzeVideo',
            videoId: videoId,
            videoTitle: videoTitle
          });
        }
      });
    }
  })();