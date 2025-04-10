// popup.js - Use this as your main script
document.addEventListener('DOMContentLoaded', function() {
    
    
    // DOM Elements - verify all elements exist
    const analyzeCurrentBtn = document.getElementById('analyze-current-video');
    const videoUrlInput = document.getElementById('video-url');
    const analyzeUrlBtn = document.getElementById('analyze-url');
    const resultsPanel = document.getElementById('results-panel');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusMessage = document.getElementById('status-message');
    const optionsBtn = document.getElementById('options-btn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    // Stats Elements
    const totalComments = document.getElementById('total-comments');
    const positiveCount = document.getElementById('positive-count');
    const positivePercent = document.getElementById('positive-percent');
    const neutralCount = document.getElementById('neutral-count');
    const neutralPercent = document.getElementById('neutral-percent');
    const negativeCount = document.getElementById('negative-count');
    const negativePercent = document.getElementById('negative-percent');
    const videoInfo = document.getElementById('video-info');
    const commentsList = document.getElementById('comments-list');
    
    // Check if all elements exist
    const elements = {
      'analyzeCurrentBtn': analyzeCurrentBtn, 
      'videoUrlInput': videoUrlInput,
      'analyzeUrlBtn': analyzeUrlBtn,
      'resultsPanel': resultsPanel,
      'loadingOverlay': loadingOverlay,
      'statusMessage': statusMessage,
      'optionsBtn': optionsBtn,
      'filterBtns': filterBtns,
      'totalComments': totalComments,
      'positiveCount': positiveCount,
      'positivePercent': positivePercent,
      'neutralCount': neutralCount,
      'neutralPercent': neutralPercent,
      'negativeCount': negativeCount,
      'negativePercent': negativePercent,
      'videoInfo': videoInfo,
      'commentsList': commentsList
    };
    
    for (const [name, element] of Object.entries(elements)) {
      if (!element) {
        console.error(`Element ${name} not found`);
      }
    }
    
    let sentimentChart = null;
    
    // Load settings
    let settings = {
      apiUrl: 'http://localhost:8000',
      maxComments: 100,
      autoAnalyze: false,
      chartType: 'pie',
      theme: 'light'
    };
    
    loadSettings();
    applyTheme();
    
    // Event Listeners
    if (analyzeCurrentBtn) {
      analyzeCurrentBtn.addEventListener('click', function() {
        analyzeCurrentVideo();
      });
    }
    
    if (analyzeUrlBtn && videoUrlInput) {
      analyzeUrlBtn.addEventListener('click', function() {
        
        analyzeVideoUrl(videoUrlInput.value);
      });
    }
    
    if (optionsBtn) {
      optionsBtn.addEventListener('click', function() {
        
        openOptions();
      });
    }
    
    if (filterBtns) {
      filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          const filter = this.dataset.filter;
          
          filterComments(filter);
          
          // Update active state
          filterBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
        });
      });
    }
    
    // Check if we're on a YouTube page
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentUrl = tabs[0].url;
      
      
      if (currentUrl.includes('youtube.com/watch')) {
        if (analyzeCurrentBtn) analyzeCurrentBtn.disabled = false;
        if (statusMessage) statusMessage.textContent = 'Ready to analyze current YouTube video';
        
        // Auto-analyze if enabled
        if (settings.autoAnalyze) {
          
          analyzeCurrentVideo();
        }
      } else {
        if (analyzeCurrentBtn) analyzeCurrentBtn.disabled = true;
        if (statusMessage) statusMessage.textContent = 'Navigate to a YouTube video to analyze comments';
      }
    });
    
    // Functions
    function loadSettings() {
      
      chrome.storage.sync.get(['apiUrl', 'maxComments', 'autoAnalyze', 'chartType', 'theme'], function(items) {
        if (items.apiUrl) settings.apiUrl = items.apiUrl;
        if (items.maxComments) settings.maxComments = items.maxComments;
        if (items.autoAnalyze !== undefined) settings.autoAnalyze = items.autoAnalyze;
        if (items.chartType) settings.chartType = items.chartType;
        if (items.theme) settings.theme = items.theme;
      });
    }
    
    function applyTheme() {
      if (settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }
    
    function openOptions() {
      chrome.runtime.openOptionsPage();
    }
    
    function showLoading(message = 'Analyzing comments...') {
      if (loadingOverlay) {
        const messageElement = loadingOverlay.querySelector('p');
        if (messageElement) messageElement.textContent = message;
        loadingOverlay.style.display = 'flex';
      }
    }
    
    function hideLoading() {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
    
    function analyzeCurrentVideo() {

      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const url = tabs[0].url;
        const videoId = extractVideoId(url);
        
        if (videoId) {
          showLoading('Fetching comments...');
          fetchAndAnalyzeComments(videoId, tabs[0].title);
        } else {
          if (statusMessage) statusMessage.textContent = 'Could not identify YouTube video ID';
        }
      });
    }
    
    function analyzeVideoUrl(url) {
    
      const videoId = extractVideoId(url);
      
      if (videoId) {
        showLoading('Fetching comments...');
        fetchAndAnalyzeComments(videoId);
      } else {
        if (statusMessage) statusMessage.textContent = 'Invalid YouTube URL';
      }
    }
    
    function extractVideoId(url) {
      const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[7].length === 11) ? match[7] : null;
    }
    
    async function fetchAndAnalyzeComments(videoId, videoTitle) {
      
      try {
        // Update status
        if (statusMessage) statusMessage.textContent = 'Fetching comments...';
        
      
        
        // Fetch comments from the API
    
        const fetchResponse = await fetch(`${settings.apiUrl}/fetch-comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            video_id: videoId,
            max_comments: settings.maxComments
          })
        });
        
       
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          throw new Error(`Error fetching comments: ${fetchResponse.status} - ${errorText}`);
        }
        
        const comments = await fetchResponse.json();
        
        
        if (comments.length === 0) {
          if (statusMessage) statusMessage.textContent = 'No comments found for this video';
          hideLoading();
          return;
        }
        
        // Extract just the text for analysis
        const commentTexts = comments.map(comment => comment.text);
        
        // Update status
        if (statusMessage) statusMessage.textContent = 'Analyzing sentiment...';
        
        // Analyze comments
      
        const analyzeResponse = await fetch(`${settings.apiUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            comments: commentTexts
          })
        });
        
        
        
        if (!analyzeResponse.ok) {
          const errorText = await analyzeResponse.text();
          throw new Error(`Error analyzing comments: ${analyzeResponse.status} - ${errorText}`);
        }
        
        const analysisResult = await analyzeResponse.json();
       
        
        // Display results
        displayResults(analysisResult, comments, videoId, videoTitle);
        
        // Update status
        if (statusMessage) statusMessage.textContent = 'Analysis complete';
        hideLoading();
        
      } catch (error) {
        console.error('Error during analysis:', error);
        if (statusMessage) statusMessage.textContent = `Error: ${error.message}`;
        hideLoading();
      }
    }
    
    function displayResults(analysisResult, comments, videoId, videoTitle) {
    
      
      // Show results panel
      if (resultsPanel) resultsPanel.style.display = 'block';
      
      // Update video info
      if (videoInfo) {
        if (videoTitle) {
          
          videoInfo.innerHTML = `
            <p><strong>Video:</strong> ${videoTitle}</p>
            <p><a href="https://youtube.com/watch?v=${videoId}" target="_blank">View on YouTube</a></p>
          `;
        } else {
          videoInfo.innerHTML = `
            <p><a href="https://youtube.com/watch?v=${videoId}" target="_blank">View on YouTube</a></p>
          `;
        }
      }
      
      // Update stats
      const summary = analysisResult.summary;
      
      
      if (!summary) {
        console.error('No summary data in analysis result');
        return;
      }
      
      const sentimentDist = summary.sentiment_distribution;
      
      
      if (!sentimentDist) {
        console.error('No sentiment distribution in summary');
        return;
      }
      
      if (totalComments) totalComments.textContent = summary.total_comments || 0;
      
      if (positiveCount && sentimentDist.positive) 
        positiveCount.textContent = sentimentDist.positive.count || 0;
      if (positivePercent && sentimentDist.positive) 
        positivePercent.textContent = `${(sentimentDist.positive.percentage || 0).toFixed(1)}%`;
      
      if (neutralCount && sentimentDist.neutral) 
        neutralCount.textContent = sentimentDist.neutral.count || 0;
      if (neutralPercent && sentimentDist.neutral) 
        neutralPercent.textContent = `${(sentimentDist.neutral.percentage || 0).toFixed(1)}%`;
      
      if (negativeCount && sentimentDist.negative) 
        negativeCount.textContent = sentimentDist.negative.count || 0;
      if (negativePercent && sentimentDist.negative) 
        negativePercent.textContent = `${(sentimentDist.negative.percentage || 0).toFixed(1)}%`;
      
      // Create chart
     
      try {
        createChart(sentimentDist);
      } catch (error) {
        console.error('Error creating chart:', error);
      }
      
      // Display comments with their sentiment
      
      try {
        displayComments(analysisResult.results, comments);
      } catch (error) {
        console.error('Error displaying comments:', error);
      }
    }
    
    function createChart(sentimentDist) {
     
      const canvas = document.getElementById('sentiment-chart');
      if (!canvas) {
        console.error('Canvas element not found');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        return;
      }
    
      // Check if Chart is defined
      if (typeof Chart === 'undefined') {
        console.error('Chart.js is not defined. Loading Chart.js dynamically.');
        
        // Add Chart.js dynamically if not available
        const script = document.createElement('script');
        script.src = 'chrome-plugin/js/chart.min.js'; // Use CDN version instead
        script.onload = function() {
         
          createChartInstance(ctx, sentimentDist);
        };
        document.head.appendChild(script);
        return;
      }
      
      createChartInstance(ctx, sentimentDist);
    }
    
    function createChartInstance(ctx, sentimentDist) {
      // Destroy existing chart if it exists
      if (sentimentChart) {
        
        sentimentChart.destroy();
      }
      
      // Create data for chart
      const data = {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [{
          data: [
            sentimentDist.positive ? sentimentDist.positive.count : 0,
            sentimentDist.neutral ? sentimentDist.neutral.count : 0,
            sentimentDist.negative ? sentimentDist.negative.count : 0
          ],
          backgroundColor: [
            '#34a853', // Green for positive
            '#fbbc05', // Yellow for neutral
            '#ea4335'  // Red for negative
          ],
          borderWidth: 1
        }]
      };

      // Create new chart
      try {
        sentimentChart = new Chart(ctx, {
          type: settings.chartType || 'pie',
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
              }
            }
          }
        });
     
      } catch (error) {
        console.error('Error creating chart instance:', error);
      }
    }
    
    function displayComments(results, comments) {
     
      
      if (!commentsList) {
        console.error('Comments list element not found');
        return;
      }
      
      commentsList.innerHTML = '';
      
      if (!results || !comments || results.length === 0) {
        commentsList.innerHTML = '<p>No comments available to display</p>';
        return;
      }
      
      if (results.length !== comments.length) {
        console.warn(`Results (${results.length}) and comments (${comments.length}) have different lengths`);
      }
      
      // Combine results with original comments to get author and other metadata
      const combinedComments = [];
      
      for (let i = 0; i < Math.min(results.length, comments.length); i++) {
        const result = results[i];
        const comment = comments[i];
        
        if (!result || !comment) {
          console.warn(`Missing result or comment at index ${i}`);
          continue;
        }
        
        const sentimentId = result.sentiment_id ?? 
                            (result.sentiment === 'positive' ? 2 : 
                             result.sentiment === 'neutral' ? 1 : 0);
        
        combinedComments.push({
          ...comment,
          sentiment: result.sentiment || 'neutral',
          sentimentId: sentimentId
        });
      }
      
 
      
      // Sort by sentiment (positive first, then neutral, then negative)
      combinedComments.sort((a, b) => b.sentimentId - a.sentimentId);
      
      // Create comment elements
      let commentsAdded = 0;
      
      combinedComments.forEach(comment => {
        try {
          if (!comment.text || !comment.sentiment) {
            console.warn('Invalid comment data:', comment);
            return;
          }
          
          const commentEl = document.createElement('div');
          commentEl.className = `comment-item comment-${comment.sentiment}`;
          commentEl.dataset.sentiment = comment.sentiment;
          
          commentEl.innerHTML = `
            <div class="comment-text">${comment.text}</div>
            <div class="comment-meta">
              <span class="comment-author">${comment.author || 'Anonymous'}</span>
              <span class="comment-sentiment sentiment-${comment.sentiment}">${comment.sentiment}</span>
            </div>
          `;
          
          commentsList.appendChild(commentEl);
          commentsAdded++;
        } catch (error) {
          console.error('Error creating comment element:', error, comment);
        }
      });
      
     
      
      if (commentsAdded === 0) {
        commentsList.innerHTML = '<p>Failed to display comments. Check console for errors.</p>';
      }
    }
    
    function filterComments(filter) {
      
      if (!commentsList) return;
      
      const comments = commentsList.querySelectorAll('.comment-item');
     
      
      comments.forEach(comment => {
        if (filter === 'all' || comment.dataset.sentiment === filter) {
          comment.style.display = 'block';
        } else {
          comment.style.display = 'none';
        }
      });
    }
    
    
});