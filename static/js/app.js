// Pastel Competitor Monitoring Dashboard JS - Fixed Navigation
(function () {
  // Data from the provided JSON
  const data = {
    "competitors": [
      {
        "id": 1,
        "name": "GitHub",
        "url": "https://github.blog/changelog/",
        "status": "active",
        "last_check": "2025-07-20T17:15:00Z",
        "changes_count": 12,
        "health": "healthy"
      },
      {
        "id": 2,
        "name": "GitLab",
        "url": "https://about.gitlab.com/releases/",
        "status": "active", 
        "last_check": "2025-07-20T17:10:00Z",
        "changes_count": 8,
        "health": "healthy"
      },
      {
        "id": 3,
        "name": "Vercel",
        "url": "https://vercel.com/changelog",
        "status": "paused",
        "last_check": "2025-07-20T16:30:00Z",
        "changes_count": 5,
        "health": "warning"
      },
      {
        "id": 4,
        "name": "Netlify",
        "url": "https://www.netlify.com/blog/tags/changelog/",
        "status": "active",
        "last_check": "2025-07-20T17:12:00Z",
        "changes_count": 15,
        "health": "healthy"
      },
      {
        "id": 5,
        "name": "Heroku",
        "url": "https://devcenter.heroku.com/changelog",
        "status": "error",
        "last_check": "2025-07-20T16:45:00Z",
        "changes_count": 3,
        "health": "error"
      }
    ],
    "dashboard_stats": {
      "total_competitors": 5,
      "active_competitors": 3,
      "total_changes": 43,
      "changes_today": 7,
      "system_status": "operational",
      "last_scan": "2025-07-20T17:15:00Z",
      "next_scan": "2025-07-20T18:15:00Z",
      "uptime": "99.9%"
    },
    "recent_changes": [
      {
        "id": 1,
        "competitor": "GitHub",
        "title": "GitHub Copilot Chat now available in IDE",
        "timestamp": "2025-07-20T16:30:00Z",
        "type": "feature",
        "summary": "GitHub announced new Copilot Chat integration for popular IDEs"
      },
      {
        "id": 2,
        "competitor": "Netlify", 
        "title": "New Edge Functions runtime released",
        "timestamp": "2025-07-20T15:45:00Z",
        "type": "feature",
        "summary": "Netlify launched improved Edge Functions with better performance"
      },
      {
        "id": 3,
        "competitor": "GitLab",
        "title": "Security vulnerability patched in CI/CD",
        "timestamp": "2025-07-20T14:20:00Z", 
        "type": "security",
        "summary": "GitLab released security patches for their CI/CD pipeline"
      },
      {
        "id": 4,
        "competitor": "GitHub",
        "title": "Pricing changes for GitHub Actions",
        "timestamp": "2025-07-20T13:15:00Z",
        "type": "pricing", 
        "summary": "GitHub updated pricing structure for Actions compute minutes"
      },
      {
        "id": 5,
        "competitor": "Vercel",
        "title": "New deployment regions added",
        "timestamp": "2025-07-20T12:00:00Z",
        "type": "infrastructure",
        "summary": "Vercel expanded to 3 new geographical deployment regions"
      }
    ],
    "analytics_data": {
      "changes_per_day": [
        {"date": "2025-07-14", "count": 5},
        {"date": "2025-07-15", "count": 8},
        {"date": "2025-07-16", "count": 3},
        {"date": "2025-07-17", "count": 12},
        {"date": "2025-07-18", "count": 7},
        {"date": "2025-07-19", "count": 9},
        {"date": "2025-07-20", "count": 7}
      ],
      "changes_by_competitor": [
        {"competitor": "Netlify", "count": 15},
        {"competitor": "GitHub", "count": 12},
        {"competitor": "GitLab", "count": 8},
        {"competitor": "Vercel", "count": 5},
        {"competitor": "Heroku", "count": 3}
      ],
      "changes_by_type": [
        {"type": "feature", "count": 18},
        {"type": "bugfix", "count": 12},
        {"type": "security", "count": 8},
        {"type": "pricing", "count": 3},
        {"type": "infrastructure", "count": 2}
      ]
    },
    "settings": {
      "monitoring_interval": 60,
      "notification_enabled": true,
      "slack_webhook": "https://hooks.slack.com/services/...",
      "groq_api_key": "gsk_...",
      "max_changes_per_scan": 50,
      "enable_summaries": true,
      "theme": "dark",
      "timezone": "UTC"
    }
  };

  // DOM elements
  let navBtns, pages, totalCompetitorsEl, activeCompetitorsEl, totalChangesEl, changesTodayEl, systemStatusEl, systemUptimeEl;
  let competitorTbody, changesTimeline, recentActivityEl;

  // Chart instances
  let changesPerDayChart, changesByCompetitorChart, changesByTypeChart;

  // Utility function to format dates
  const formatDate = (iso) => {
    return new Date(iso).toLocaleString(undefined, { 
      year: "numeric", 
      month: "short", 
      day: "numeric", 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  // Utility function to format relative time
  const formatRelativeTime = (iso) => {
    const now = new Date();
    const date = new Date(iso);
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  /* ---------- NAVIGATION - FIXED ----------- */
  function showPage(targetId) {
    console.log('Showing page:', targetId); // Debug log
    
    // Hide all pages
    pages.forEach(page => {
      page.classList.add("hidden");
      page.style.display = "none";
    });
    
    // Show target page
    const targetPage = document.getElementById(targetId);
    if (targetPage) {
      targetPage.classList.remove("hidden");
      targetPage.style.display = "block";
      console.log('Page shown:', targetId); // Debug log
    } else {
      console.error('Page not found:', targetId); // Debug log
    }
    
    // Update navigation button states
    navBtns.forEach(btn => {
      if (btn.dataset.target === targetId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Render charts when analytics page is shown
    if (targetId === 'analytics') {
      setTimeout(() => {
        renderAnalyticsCharts();
      }, 100);
    }
  }

  function setupNavigation() {
    navBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        console.log('Navigation clicked:', target); // Debug log
        showPage(target);
      });
    });
  }

  /* ---------- DASHBOARD RENDERERS ----------- */
  function renderDashboardStats() {
    const stats = data.dashboard_stats;
    if (totalCompetitorsEl) totalCompetitorsEl.textContent = stats.total_competitors;
    if (activeCompetitorsEl) activeCompetitorsEl.textContent = stats.active_competitors;
    if (totalChangesEl) totalChangesEl.textContent = stats.total_changes;
    if (changesTodayEl) changesTodayEl.textContent = stats.changes_today;
    if (systemUptimeEl) systemUptimeEl.textContent = stats.uptime;

    // System status
    if (systemStatusEl) {
      const statusClass = stats.system_status === 'operational' ? 'operational' : 'warning';
      systemStatusEl.innerHTML = `
        <div class="system-status">
          <h3>System Status</h3>
          <div>
            <span class="system-status-indicator ${statusClass}"></span>
            <span>${stats.system_status.charAt(0).toUpperCase() + stats.system_status.slice(1)}</span>
          </div>
          <p style="margin: 8px 0 0 0; font-size: var(--font-size-sm); color: var(--pastel-text-secondary);">
            Last scan: ${formatRelativeTime(stats.last_scan)}
          </p>
        </div>`;
    }
  }

  function renderRecentActivity() {
    if (!recentActivityEl) return;
    recentActivityEl.innerHTML = "";
    data.recent_changes.slice(0, 3).forEach(change => {
      const div = document.createElement("div");
      div.className = `activity-item ${change.type}`;
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <strong>${change.competitor}</strong> - ${change.title}
          </div>
          <span style="font-size: var(--font-size-sm); color: var(--pastel-text-secondary);">
            ${formatRelativeTime(change.timestamp)}
          </span>
        </div>
        <p style="margin: 4px 0 0 0; font-size: var(--font-size-sm); color: var(--pastel-text-secondary);">
          ${change.summary}
        </p>`;
      recentActivityEl.appendChild(div);
    });
  }

  /* ---------- COMPETITORS PAGE ----------- */
  function renderCompetitors() {
    if (!competitorTbody) return;
    competitorTbody.innerHTML = "";
    data.competitors.forEach(c => {
      const tr = document.createElement("tr");
      
      // Status badge
      let statusClass = 'status--info';
      if (c.status === 'active') statusClass = 'status--success';
      else if (c.status === 'error') statusClass = 'status--error';
      else if (c.status === 'paused') statusClass = 'status--warning';

      // Health badge
      let healthClass = 'status--info';
      if (c.health === 'healthy') healthClass = 'status--success';
      else if (c.health === 'warning') healthClass = 'status--warning';
      else if (c.health === 'error') healthClass = 'status--error';

      tr.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td><a href="${c.url}" target="_blank">${c.url}</a></td>
        <td><span class="status ${statusClass}">${c.status}</span></td>
        <td>${formatRelativeTime(c.last_check)}</td>
        <td>${c.changes_count}</td>
        <td><span class="status ${healthClass}">${c.health}</span></td>`;
      competitorTbody.appendChild(tr);
    });
  }

  /* ---------- CHANGES PAGE ----------- */
  function renderChanges() {
    if (!changesTimeline) return;
    changesTimeline.innerHTML = "";
    [...data.recent_changes].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(change => {
      const div = document.createElement("div");
      div.className = `card timeline-item ${change.type}`;
      div.innerHTML = `
        <div class="card__body">
          <h4>${change.competitor} - ${change.title}</h4>
          <p style="color: var(--pastel-text-secondary); margin-bottom: 8px; font-size: var(--font-size-sm);">
            ${formatDate(change.timestamp)} • ${change.type}
          </p>
          <p style="margin: 0;">${change.summary}</p>
        </div>`;
      changesTimeline.appendChild(div);
    });
  }

  /* ---------- ANALYTICS CHARTS ----------- */
  function renderAnalyticsCharts() {
    // Changes per Day Chart
    const changesPerDayCtx = document.getElementById("changesPerDayChart");
    if (changesPerDayCtx && !changesPerDayChart) {
      changesPerDayChart = new Chart(changesPerDayCtx, {
        type: "line",
        data: {
          labels: data.analytics_data.changes_per_day.map(d => new Date(d.date).toLocaleDateString()),
          datasets: [{
            label: "Changes",
            data: data.analytics_data.changes_per_day.map(d => d.count),
            borderColor: "#e6e0ff",
            backgroundColor: "rgba(230, 224, 255, 0.2)",
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

    // Changes by Competitor Chart
    const changesByCompetitorCtx = document.getElementById("changesByCompetitorChart");
    if (changesByCompetitorCtx && !changesByCompetitorChart) {
      changesByCompetitorChart = new Chart(changesByCompetitorCtx, {
        type: "doughnut",
        data: {
          labels: data.analytics_data.changes_by_competitor.map(d => d.competitor),
          datasets: [{
            data: data.analytics_data.changes_by_competitor.map(d => d.count),
            backgroundColor: ["#e6e0ff", "#d0f0e6", "#ffe5d9", "#ffe1e6", "#e1f5fe"],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: 'bottom',
              labels: { fontSize: 12 }
            }
          }
        }
      });
    }

    // Changes by Type Chart
    const changesByTypeCtx = document.getElementById("changesByTypeChart");
    if (changesByTypeCtx && !changesByTypeChart) {
      changesByTypeChart = new Chart(changesByTypeCtx, {
        type: "bar",
        data: {
          labels: data.analytics_data.changes_by_type.map(d => d.type),
          datasets: [{
            label: "Changes",
            data: data.analytics_data.changes_by_type.map(d => d.count),
            backgroundColor: ["#e6e0ff", "#d0f0e6", "#ffe5d9", "#ffe1e6", "#e1f5fe"],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }
  }

  /* ---------- SETTINGS PAGE ----------- */
  function loadSettings() {
    const settings = data.settings;
    const monitoringInterval = document.getElementById("monitoringInterval");
    const notificationEnabled = document.getElementById("notificationEnabled");
    const slackWebhook = document.getElementById("slackWebhook");
    const groqApiKey = document.getElementById("groqApiKey");
    const maxChanges = document.getElementById("maxChanges");
    const enableSummaries = document.getElementById("enableSummaries");
    const timezone = document.getElementById("timezone");

    if (monitoringInterval) monitoringInterval.value = settings.monitoring_interval;
    if (notificationEnabled) notificationEnabled.checked = settings.notification_enabled;
    if (slackWebhook) slackWebhook.value = settings.slack_webhook;
    if (groqApiKey) groqApiKey.value = settings.groq_api_key;
    if (maxChanges) maxChanges.value = settings.max_changes_per_scan;
    if (enableSummaries) enableSummaries.checked = settings.enable_summaries;
    if (timezone) timezone.value = settings.timezone;
  }

  // Global function for save button
  window.saveSettings = function() {
    const settings = {
      monitoring_interval: parseInt(document.getElementById("monitoringInterval").value),
      notification_enabled: document.getElementById("notificationEnabled").checked,
      slack_webhook: document.getElementById("slackWebhook").value,
      groq_api_key: document.getElementById("groqApiKey").value,
      max_changes_per_scan: parseInt(document.getElementById("maxChanges").value),
      enable_summaries: document.getElementById("enableSummaries").checked,
      timezone: document.getElementById("timezone").value
    };
    
    // Update data object
    data.settings = { ...data.settings, ...settings };
    
    // Show success message
    const successDiv = document.createElement("div");
    successDiv.className = "status status--success mt-8";
    successDiv.textContent = "Settings saved successfully!";
    
    const settingsCard = document.querySelector("#settings .card__body");
    if (settingsCard) {
      settingsCard.appendChild(successDiv);
      
      setTimeout(() => {
        if (successDiv.parentNode) {
          successDiv.parentNode.removeChild(successDiv);
        }
      }, 3000);
    }
  };

  /* ---------- INITIALIZATION ----------- */
  function init() {
    console.log('Initializing app...'); // Debug log
    
    // Get DOM elements
    navBtns = document.querySelectorAll(".nav-btn");
    pages = document.querySelectorAll(".page");
    totalCompetitorsEl = document.getElementById("totalCompetitors");
    activeCompetitorsEl = document.getElementById("activeCompetitors");
    totalChangesEl = document.getElementById("totalChanges");
    changesTodayEl = document.getElementById("changesToday");
    systemStatusEl = document.getElementById("systemStatus");
    systemUptimeEl = document.getElementById("systemUptime");
    competitorTbody = document.getElementById("competitorTbody");
    changesTimeline = document.getElementById("changesTimeline");
    recentActivityEl = document.getElementById("recentActivity");

    console.log('Found nav buttons:', navBtns.length); // Debug log
    console.log('Found pages:', pages.length); // Debug log

    // Setup navigation
    setupNavigation();

    // Render all content
    renderDashboardStats();
    renderRecentActivity();
    renderCompetitors();
    renderChanges();
    loadSettings();

    // Show dashboard by default
    showPage("dashboard");
    
    console.log('App initialized successfully'); // Debug log
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();