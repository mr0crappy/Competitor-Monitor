// Application State
const appState = {
  currentSection: 'dashboard',
  competitors: [
    {
      id: 1,
      name: "TechCorp",
      url: "https://techcorp.com/changelog",
      status: "active",
      last_checked: "2025-07-20T15:23:00Z",
      change_count: 12
    },
    {
      id: 2,
      name: "InnovateLabs",
      url: "https://innovatelabs.com/updates",
      status: "active",
      last_checked: "2025-07-20T15:23:00Z",
      change_count: 8
    },
    {
      id: 3,
      name: "DataFlow",
      url: "https://dataflow.io/releases",
      status: "paused",
      last_checked: "2025-07-19T10:15:00Z",
      change_count: 15
    }
  ],
  changes: [
    {
      id: 1,
      competitor: "TechCorp",
      timestamp: "2025-07-20T14:30:00Z",
      summary: "Added new API endpoints for data export",
      details: ["New /api/export endpoint", "Enhanced authentication", "Updated documentation"]
    },
    {
      id: 2,
      competitor: "InnovateLabs",
      timestamp: "2025-07-20T12:15:00Z",
      summary: "Released version 2.1 with performance improvements",
      details: ["50% faster processing", "Reduced memory usage", "Bug fixes"]
    },
    {
      id: 3,
      competitor: "DataFlow",
      timestamp: "2025-07-19T16:45:00Z",
      summary: "Major UI redesign announced",
      details: ["New dashboard interface", "Improved user experience", "Mobile optimization"]
    }
  ],
  analytics: {
    activity_data: [
      {"date": "2025-07-14", "changes": 3},
      {"date": "2025-07-15", "changes": 2},
      {"date": "2025-07-16", "changes": 5},
      {"date": "2025-07-17", "changes": 1},
      {"date": "2025-07-18", "changes": 4},
      {"date": "2025-07-19", "changes": 3},
      {"date": "2025-07-20", "changes": 2}
    ],
    top_competitors: [
      {"name": "DataFlow", "changes": 15},
      {"name": "TechCorp", "changes": 12},
      {"name": "InnovateLabs", "changes": 8}
    ]
  },
  dashboard_stats: {
    total_competitors: 3,
    recent_changes: 5,
    system_status: "running",
    last_check: "2025-07-20T15:23:00Z"
  },
  settings: {
    slack_webhook: "",
    groq_api_key: "",
    notifications_enabled: true,
    check_frequency: 60,
    backend_url: "https://your-app.up.railway.app"
  },
  editingCompetitor: null
};

// Utility Functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  
  toastMessage.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Navigation Management
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');
  const pageTitle = document.getElementById('pageTitle');
  
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetSection = link.dataset.section;
      
      // Update active nav link
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      // Show target section
      sections.forEach(section => section.classList.remove('active'));
      document.getElementById(targetSection).classList.add('active');
      
      // Update page title
      const titles = {
        dashboard: 'Dashboard Overview',
        competitors: 'Competitors',
        changes: 'Change History',
        analytics: 'Analytics',
        settings: 'Settings'
      };
      pageTitle.textContent = titles[targetSection];
      
      // Update app state
      appState.currentSection = targetSection;
      
      // Load section-specific content
      loadSectionContent(targetSection);
      
      // Close mobile sidebar if open
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });
}

// Section Content Loading
function loadSectionContent(section) {
  switch (section) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'competitors':
      renderCompetitors();
      break;
    case 'changes':
      renderChanges();
      break;
    case 'analytics':
      renderAnalytics();
      break;
    case 'settings':
      renderSettings();
      break;
  }
}

// Dashboard Rendering
function renderDashboard() {
  document.getElementById('totalCompetitors').textContent = appState.dashboard_stats.total_competitors;
  document.getElementById('recentChanges').textContent = appState.dashboard_stats.recent_changes;
  document.getElementById('lastCheck').textContent = formatTime(appState.dashboard_stats.last_check);
}

// Competitors Rendering
function renderCompetitors() {
  const grid = document.getElementById('competitorsGrid');
  grid.innerHTML = '';
  
  appState.competitors.forEach(competitor => {
    const card = document.createElement('div');
    card.className = 'competitor-card';
    card.innerHTML = `
      <div class="competitor-card__header">
        <div>
          <h3 class="competitor-card__name">${competitor.name}</h3>
          <a href="${competitor.url}" target="_blank" class="competitor-card__url">${competitor.url}</a>
        </div>
        <span class="status ${competitor.status === 'active' ? 'status--success' : 'status--warning'}">
          ${competitor.status === 'active' ? 'Active' : 'Paused'}
        </span>
      </div>
      <div class="competitor-card__info">
        <div class="info-item">
          <p class="info-item__label">Last Checked</p>
          <p class="info-item__value">${formatTime(competitor.last_checked)}</p>
        </div>
        <div class="info-item">
          <p class="info-item__label">Changes</p>
          <p class="info-item__value">${competitor.change_count}</p>
        </div>
      </div>
      <div class="competitor-card__actions">
        <button class="btn btn--sm btn--outline" onclick="editCompetitor(${competitor.id})">Edit</button>
        <button class="btn btn--sm btn--outline" onclick="toggleCompetitorStatus(${competitor.id})">
          ${competitor.status === 'active' ? 'Pause' : 'Activate'}
        </button>
        <button class="btn btn--sm btn--outline" onclick="deleteCompetitor(${competitor.id})">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Changes Rendering
function renderChanges() {
  const container = document.getElementById('changesList');
  container.innerHTML = '';
  
  // Populate competitor filter
  const filter = document.getElementById('competitorFilter');
  filter.innerHTML = '<option value="">All Competitors</option>';
  appState.competitors.forEach(competitor => {
    filter.innerHTML += `<option value="${competitor.name}">${competitor.name}</option>`;
  });
  
  // Render changes
  appState.changes.forEach(change => {
    const item = document.createElement('div');
    item.className = 'change-item';
    item.innerHTML = `
      <div class="change-item__header">
        <div class="change-item__meta">
          <span class="change-item__competitor">${change.competitor}</span>
          <span class="change-item__timestamp">${formatDate(change.timestamp)}</span>
        </div>
      </div>
      <p class="change-item__summary">${change.summary}</p>
      <ul class="change-item__details">
        ${change.details.map(detail => `<li>${detail}</li>`).join('')}
      </ul>
    `;
    container.appendChild(item);
  });
}

// Analytics Rendering
function renderAnalytics() {
  renderActivityChart();
  renderCompetitorRanking();
}

function renderActivityChart() {
  const ctx = document.getElementById('activityChart').getContext('2d');
  
  // Destroy existing chart if it exists
  if (window.activityChart) {
    window.activityChart.destroy();
  }
  
  window.activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: appState.analytics.activity_data.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString([], {month: 'short', day: 'numeric'});
      }),
      datasets: [{
        label: 'Changes',
        data: appState.analytics.activity_data.map(item => item.changes),
        borderColor: '#00D4FF',
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#FFFFFF'
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#B3B3B3'
          },
          grid: {
            color: '#404040'
          }
        },
        y: {
          ticks: {
            color: '#B3B3B3'
          },
          grid: {
            color: '#404040'
          }
        }
      }
    }
  });
}

function renderCompetitorRanking() {
  const container = document.getElementById('competitorRanking');
  container.innerHTML = '';
  
  appState.analytics.top_competitors.forEach(competitor => {
    const item = document.createElement('div');
    item.className = 'ranking-item';
    item.innerHTML = `
      <span class="ranking-item__name">${competitor.name}</span>
      <span class="ranking-item__count">${competitor.changes}</span>
    `;
    container.appendChild(item);
  });
}

// Settings Rendering
function renderSettings() {
  document.getElementById('slackWebhook').value = appState.settings.slack_webhook;
  document.getElementById('groqApiKey').value = appState.settings.groq_api_key;
  document.getElementById('notificationsEnabled').checked = appState.settings.notifications_enabled;
  document.getElementById('checkFrequency').value = appState.settings.check_frequency;
}

// Competitor Management
function addCompetitor() {
  appState.editingCompetitor = null;
  document.getElementById('competitorModalTitle').textContent = 'Add Competitor';
  document.getElementById('competitorName').value = '';
  document.getElementById('competitorUrl').value = '';
  document.getElementById('competitorStatus').checked = true;
  document.getElementById('competitorModalOverlay').classList.add('active');
}

function editCompetitor(id) {
  const competitor = appState.competitors.find(c => c.id === id);
  if (!competitor) return;
  
  appState.editingCompetitor = competitor;
  document.getElementById('competitorModalTitle').textContent = 'Edit Competitor';
  document.getElementById('competitorName').value = competitor.name;
  document.getElementById('competitorUrl').value = competitor.url;
  document.getElementById('competitorStatus').checked = competitor.status === 'active';
  document.getElementById('competitorModalOverlay').classList.add('active');
}

function deleteCompetitor(id) {
  if (confirm('Are you sure you want to delete this competitor?')) {
    appState.competitors = appState.competitors.filter(c => c.id !== id);
    appState.dashboard_stats.total_competitors = appState.competitors.length;
    renderCompetitors();
    renderDashboard();
    showToast('Competitor deleted successfully');
  }
}

function toggleCompetitorStatus(id) {
  const competitor = appState.competitors.find(c => c.id === id);
  if (competitor) {
    competitor.status = competitor.status === 'active' ? 'paused' : 'active';
    renderCompetitors();
    showToast(`Competitor ${competitor.status === 'active' ? 'activated' : 'paused'}`);
  }
}

function saveCompetitor(event) {
  event.preventDefault();
  
  const name = document.getElementById('competitorName').value;
  const url = document.getElementById('competitorUrl').value;
  const status = document.getElementById('competitorStatus').checked ? 'active' : 'paused';
  
  if (appState.editingCompetitor) {
    // Edit existing competitor
    appState.editingCompetitor.name = name;
    appState.editingCompetitor.url = url;
    appState.editingCompetitor.status = status;
    showToast('Competitor updated successfully');
  } else {
    // Add new competitor
    const newId = Math.max(...appState.competitors.map(c => c.id)) + 1;
    appState.competitors.push({
      id: newId,
      name,
      url,
      status,
      last_checked: new Date().toISOString(),
      change_count: 0
    });
    appState.dashboard_stats.total_competitors = appState.competitors.length;
    showToast('Competitor added successfully');
  }
  
  closeCompetitorModal();
  renderCompetitors();
  renderDashboard();
}

function closeCompetitorModal() {
  document.getElementById('competitorModalOverlay').classList.remove('active');
  appState.editingCompetitor = null;
}

// Search and Filter
function initSearch() {
  const searchInput = document.getElementById('competitorSearch');
  const competitorFilter = document.getElementById('competitorFilter');
  const dateFilter = document.getElementById('dateFilter');
  
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.competitor-card');
    
    cards.forEach(card => {
      const name = card.querySelector('.competitor-card__name').textContent.toLowerCase();
      const url = card.querySelector('.competitor-card__url').textContent.toLowerCase();
      
      if (name.includes(query) || url.includes(query)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
  
  competitorFilter?.addEventListener('change', filterChanges);
  dateFilter?.addEventListener('change', filterChanges);
}

function filterChanges() {
  const competitorFilter = document.getElementById('competitorFilter').value;
  const dateFilter = document.getElementById('dateFilter').value;
  const changeItems = document.querySelectorAll('.change-item');
  
  changeItems.forEach(item => {
    const competitor = item.querySelector('.change-item__competitor').textContent;
    const timestamp = item.querySelector('.change-item__timestamp').textContent;
    
    let show = true;
    
    if (competitorFilter && competitor !== competitorFilter) {
      show = false;
    }
    
    if (dateFilter) {
      const itemDate = new Date(timestamp).toISOString().split('T')[0];
      if (itemDate !== dateFilter) {
        show = false;
      }
    }
    
    item.style.display = show ? 'block' : 'none';
  });
}

// Settings Management
function saveApiSettings(event) {
  event.preventDefault();
  
  appState.settings.slack_webhook = document.getElementById('slackWebhook').value;
  appState.settings.groq_api_key = document.getElementById('groqApiKey').value;
  
  showToast('API settings saved successfully');
}

function saveNotificationSettings(event) {
  event.preventDefault();
  
  appState.settings.notifications_enabled = document.getElementById('notificationsEnabled').checked;
  appState.settings.check_frequency = parseInt(document.getElementById('checkFrequency').value);
  
  showToast('Notification preferences saved successfully');
}

// Manual Monitor Trigger
function runMonitor() {
  const button = document.getElementById('manualTrigger');
  const originalText = button.innerHTML;
  
  button.innerHTML = `
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
    Running...
  `;
  button.disabled = true;
  
  // Simulate API call
  setTimeout(() => {
    button.innerHTML = originalText;
    button.disabled = false;
    showToast('Monitor run completed successfully');
    
    // Update last check time
    appState.dashboard_stats.last_check = new Date().toISOString();
    document.getElementById('lastCheck').textContent = formatTime(appState.dashboard_stats.last_check);
  }, 2000);
}

// Sidebar Toggle for Mobile
function initSidebarToggle() {
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.getElementById('sidebar');
  
  mobileMenuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
  
  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        !sidebar.contains(e.target) && 
        !mobileMenuToggle.contains(e.target) &&
        sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    }
  });
}

// Quick Actions
function initQuickActions() {
  document.getElementById('viewAllChanges')?.addEventListener('click', () => {
    document.querySelector('[data-section="changes"]').click();
  });
  
  document.getElementById('addCompetitorBtn')?.addEventListener('click', addCompetitor);
}

// API Functions (Mock Implementation)
const API = {
  async getDashboard() {
    const res = await fetch(`${appState.settings.backend_url}/api/dashboard`);
    return await res.json();
  },

  async getCompetitors() {
    const res = await fetch(`${appState.settings.backend_url}/api/competitors`);
    return await res.json();
  },

  async addCompetitor(data) {
    const res = await fetch(`${appState.settings.backend_url}/api/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async runMonitor() {
    const res = await fetch(`${appState.settings.backend_url}/api/run-monitor`, {
      method: 'POST'
    });
    return await res.json();
  }
};


// Add CSS for spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all components
  initNavigation();
  initSidebarToggle();
  initSearch();
  initQuickActions();
  
  // Set up event listeners
  document.getElementById('competitorForm').addEventListener('submit', saveCompetitor);
  document.getElementById('apiSettingsForm').addEventListener('submit', saveApiSettings);
  document.getElementById('notificationSettingsForm').addEventListener('submit', saveNotificationSettings);
  document.getElementById('manualTrigger').addEventListener('click', runMonitor);
  
  // Modal event listeners
  document.getElementById('addCompetitorModal').addEventListener('click', addCompetitor);
  document.getElementById('competitorModalClose').addEventListener('click', closeCompetitorModal);
  document.getElementById('cancelCompetitor').addEventListener('click', closeCompetitorModal);
  
  // Toast close listener
  document.getElementById('toastClose').addEventListener('click', () => {
    document.getElementById('toast').classList.remove('show');
  });
  
  // Close modal when clicking overlay
  document.getElementById('competitorModalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeCompetitorModal();
    }
  });
  
  // Load initial content
  loadSectionContent('dashboard');
  
  console.log('Competitor Monitor Dashboard initialized successfully!');
});