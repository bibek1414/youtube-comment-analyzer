
// options.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const apiUrlInput = document.getElementById('api-url');
    const maxCommentsInput = document.getElementById('max-comments');
    const autoAnalyzeInput = document.getElementById('auto-analyze');
    const chartTypeSelect = document.getElementById('chart-type');
    const themeSelect = document.getElementById('theme');
    const saveBtn = document.getElementById('save-options');
    const resetBtn = document.getElementById('reset-options');
    const statusMessage = document.getElementById('status-message');
    const backToPopupLink = document.getElementById('back-to-popup');
    
    // Default settings
    const defaultSettings = {
      apiUrl: 'http://localhost:8000',
      maxComments: 100,
      autoAnalyze: false,
      chartType: 'pie',
      theme: 'light'
    };
    
    // Load current settings
    loadSettings();
    
    // Event Listeners
    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetSettings);
    backToPopupLink.addEventListener('click', function(e) {
      e.preventDefault();
      window.close();
    });
    
    // Functions
    function loadSettings() {
      chrome.storage.sync.get(['apiUrl', 'maxComments', 'autoAnalyze', 'chartType', 'theme'], function(items) {
        apiUrlInput.value = items.apiUrl || defaultSettings.apiUrl;
        maxCommentsInput.value = items.maxComments || defaultSettings.maxComments;
        autoAnalyzeInput.checked = items.autoAnalyze !== undefined ? items.autoAnalyze : defaultSettings.autoAnalyze;
        chartTypeSelect.value = items.chartType || defaultSettings.chartType;
        themeSelect.value = items.theme || defaultSettings.theme;
      });
    }
    
    function saveSettings() {
      const settings = {
        apiUrl: apiUrlInput.value,
        maxComments: parseInt(maxCommentsInput.value, 10),
        autoAnalyze: autoAnalyzeInput.checked,
        chartType: chartTypeSelect.value,
        theme: themeSelect.value
      };
      
      chrome.storage.sync.set(settings, function() {
        showStatus('Settings saved successfully!', 'success');
      });
    }
    
    function resetSettings() {
      chrome.storage.sync.set(defaultSettings, function() {
        loadSettings();
        showStatus('Settings reset to default values.', 'success');
      });
    }
    
    function showStatus(message, type) {
      statusMessage.textContent = message;
      statusMessage.className = 'status-message';
      statusMessage.classList.add(type);
      
      setTimeout(function() {
        statusMessage.style.display = 'none';
      }, 3000);
    }
  });
  
  