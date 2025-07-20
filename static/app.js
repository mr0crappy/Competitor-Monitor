/* app.js – Live API-enabled frontend for Competitor Monitor */

/* ------------------------------------------------------------------ */
/* Config + State                                                      */
/* ------------------------------------------------------------------ */
const appState = {
  currentSection: "dashboard",
  competitors: [],
  changes: [],
  analytics: {
    activity_data: [],
    top_competitors: []
  },
  dashboard_stats: {
    totalCompetitors: 0,
    recentChanges24h: 0,
    systemStatus: {},
    activeCompetitors: 0
  },
  settings: {
    slackWebhook: false,
    groqApiKey: false,
    notifications_enabled: true,
    check_frequency: 60,
    backend_url: ""  // auto-filled from window.origin
  },
  editingCompetitor: null,
  refreshTimer: null
};

// Derive backend base URL
(function initBackendBase() {
  // If you want to override, hardcode here:
  // appState.settings.backend_url = "https://your-app.up.railway.app";
  if (!appState.settings.backend_url) {
    appState.settings.backend_url = window.location.origin;
  }
})();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function fmtDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtTime(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  if (!toast || !toastMessage) {
    console[type === "error" ? "error" : "log"](`[Toast:${type}] ${message}`);
    return;
  }
  toastMessage.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function setLoading(btn, isLoading, loadingLabel = "Working...") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.origLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
      </svg> ${loadingLabel}
    `;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.origLabel || "Run Monitor";
  }
}

/* ------------------------------------------------------------------ */
/* API Client                                                          */
/* ------------------------------------------------------------------ */
async function apiFetch(path, options = {}) {
  const base = appState.settings.backend_url.replace(/\/+$/, "");
  const url = `${base}${path}`;
  const cfg = {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  };
  try {
    const res = await fetch(url, cfg);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
    }
    // Some endpoints (like DELETE) may return 204; guard that
    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) {
      return await res.json();
    }
    return {};
  } catch (err) {
    console.error(`[API ERROR] ${url}`, err);
    showToast(`API error: ${err.message}`, "error");
    throw err;
  }
}

const API = {
  getDashboard: () => apiFetch("/api/dashboard", { method: "GET" }),
  getCompetitors: () => apiFetch("/api/competitors", { method: "GET" }),
  addCompetitor: (data) => apiFetch("/api/competitors", { method: "POST", body: JSON.stringify(data) }),
  updateCompetitor: (id, data) => apiFetch(`/api/competitors/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCompetitor: (id) => apiFetch(`/api/competitors/${id}`, { method: "DELETE" }),
  getChanges: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiFetch(`/api/changes?${params.toString()}`, { method: "GET" });
  },
  runMonitor: () => apiFetch("/api/run-monitor", { method: "POST" }),
  getStatus: () => apiFetch("/api/status", { method: "GET" }),
  getAnalytics: () => apiFetch("/api/analytics", { method: "GET" }),
  getSettings: () => apiFetch("/api/settings", { method: "GET" }),
  updateSettings: (data) => apiFetch("/api/settings", { method: "POST", body: JSON.stringify(data) })
};

/* ------------------------------------------------------------------ */
/* Render Functions                                                    */
/* ------------------------------------------------------------------ */
function renderDashboard() {
  const stats = appState.dashboard_stats;
  const total = document.getElementById("totalCompetitors");
  const recent = document.getElementById("recentChanges");
  const last = document.getElementById("lastCheck");
  const statusWrap = document.getElementById("systemStatus");
  if (total) total.textContent = stats.totalCompetitors ?? stats.total_competitors ?? 0;
  if (recent) recent.textContent = stats.recentChanges24h ?? stats.recent_changes ?? 0;
  if (last) last.textContent = fmtTime(stats.systemStatus?.lastRun || stats.last_check);
  if (statusWrap) {
    statusWrap.querySelector(".status-text")?.replaceChildren(document.createTextNode(
      stats.systemStatus?.isRunning ? "Running…" : "Idle"
    ));
    const dot = statusWrap.querySelector(".status-dot");
    if (dot) {
      dot.style.background = stats.systemStatus?.isRunning ? "var(--color-warning)" : "var(--color-success)";
    }
  }
}

function renderCompetitors() {
  const grid = document.getElementById("competitorsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  appState.competitors.forEach((c) => {
    const card = document.createElement("div");
    card.className = "competitor-card";
    const statusCls = c.status === "active" ? "status--success" : "status--warning";
    const statusText = c.status === "active" ? "Active" : "Paused";
    card.innerHTML = `
      <div class="competitor-card__header">
        <div>
          <h3 class="competitor-card__name">${c.name}</h3>
          <a href="${c.changelog || c.url}" target="_blank" class="competitor-card__url">${c.changelog || c.url}</a>
        </div>
        <span class="status ${statusCls}">${statusText}</span>
      </div>
      <div class="competitor-card__info">
        <div class="info-item">
          <p class="info-item__label">Last Update</p>
          <p class="info-item__value">${fmtTime(c.lastUpdate || c.last_checked)}</p>
        </div>
        <div class="info-item">
          <p class="info-item__label">Changes</p>
          <p class="info-item__value">${c.changesDetected ?? c.change_count ?? 0}</p>
        </div>
      </div>
      <div class="competitor-card__actions">
        <button class="btn btn--sm btn--outline" data-action="edit" data-id="${c.id}">Edit</button>
        <button class="btn btn--sm btn--outline" data-action="toggle" data-id="${c.id}">${statusText === "Active" ? "Pause" : "Activate"}</button>
        <button class="btn btn--sm btn--outline" data-action="delete" data-id="${c.id}">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Attach event delegation
  grid.addEventListener("click", competitorGridClick, { once: true });
}
function competitorGridClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === "edit") editCompetitor(id);
  else if (action === "toggle") toggleCompetitorStatus(id);
  else if (action === "delete") deleteCompetitor(id);
  // re-bind for future clicks
  document.getElementById("competitorsGrid").addEventListener("click", competitorGridClick, { once: true });
}

function renderChanges() {
  const container = document.getElementById("changesList");
  const filter = document.getElementById("competitorFilter");
  if (!container) return;
  container.innerHTML = "";

  // Populate filter
  if (filter) {
    filter.innerHTML = '<option value="">All Competitors</option>';
    appState.competitors.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      filter.appendChild(opt);
    });
  }

  appState.changes.forEach((chg) => {
    const div = document.createElement("div");
    div.className = "change-item";
    const tsFmt = fmtDate(chg.timestamp);
    div.innerHTML = `
      <div class="change-item__header">
        <div class="change-item__meta">
          <span class="change-item__competitor">${chg.competitor}</span>
          <span class="change-item__timestamp">${tsFmt}</span>
        </div>
      </div>
      <p class="change-item__summary">${chg.summary || chg.change || "(no summary)"}</p>
      ${
        chg.changes && chg.changes.length
          ? `<ul class="change-item__details">${chg.changes.map((d) => `<li>${d}</li>`).join("")}</ul>`
          : ""
      }
    `;
    container.appendChild(div);
  });
}

function renderAnalytics() {
  renderActivityChart();
  renderCompetitorRanking();
}
function renderActivityChart() {
  const canvas = document.getElementById("activityChart");
  if (!canvas || typeof Chart === "undefined") return;
  const ctx = canvas.getContext("2d");
  if (window.activityChart) window.activityChart.destroy();
  const labels = appState.analytics.activity_data.map((d) => {
    const date = new Date(d.date);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  });
  const data = appState.analytics.activity_data.map((d) => d.changes);
  window.activityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Changes",
          data,
          borderColor: "#00D4FF",
          backgroundColor: "rgba(0, 212, 255, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#FFFFFF" } } },
      scales: {
        x: { ticks: { color: "#B3B3B3" }, grid: { color: "#404040" } },
        y: { ticks: { color: "#B3B3B3" }, grid: { color: "#404040" } }
      }
    }
  });
}
function renderCompetitorRanking() {
  const container = document.getElementById("competitorRanking");
  if (!container) return;
  container.innerHTML = "";
  appState.analytics.top_competitors.forEach((c) => {
    const div = document.createElement("div");
    div.className = "ranking-item";
    div.innerHTML = `
      <span class="ranking-item__name">${c.name || c.competitor}</span>
      <span class="ranking-item__count">${c.changes}</span>
    `;
    container.appendChild(div);
  });
}

function renderSettings() {
  const slack = document.getElementById("slackWebhook");
  const groq = document.getElementById("groqApiKey");
  const notif = document.getElementById("notificationsEnabled");
  const freq = document.getElementById("checkFrequency");
  if (slack) slack.value = appState.settings.slack_webhook ?? "";
  if (groq) groq.value = appState.settings.groq_api_key ?? "";
  if (notif) notif.checked = !!appState.settings.notifications_enabled;
  if (freq) freq.value = appState.settings.check_frequency ?? 60;
}

/* ------------------------------------------------------------------ */
/* Section Loader                                                      */
/* ------------------------------------------------------------------ */
function loadSectionContent(section) {
  switch (section) {
    case "dashboard":
      renderDashboard(); break;
    case "competitors":
      renderCompetitors(); break;
    case "changes":
      renderChanges(); break;
    case "analytics":
      renderAnalytics(); break;
    case "settings":
      renderSettings(); break;
  }
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".section");
  const pageTitle = document.getElementById("pageTitle");

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.dataset.section;
      navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      sections.forEach((s) => s.classList.remove("active"));
      document.getElementById(target).classList.add("active");
      const titles = {
        dashboard: "Dashboard Overview",
        competitors: "Competitors",
        changes: "Change History",
        analytics: "Analytics",
        settings: "Settings"
      };
      if (pageTitle) pageTitle.textContent = titles[target] || "Dashboard";
      appState.currentSection = target;
      loadSectionContent(target);
      if (window.innerWidth <= 768) {
        document.getElementById("sidebar")?.classList.remove("open");
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Competitor Modal + Actions                                          */
/* ------------------------------------------------------------------ */
function addCompetitor() {
  appState.editingCompetitor = null;
  document.getElementById("competitorModalTitle").textContent = "Add Competitor";
  document.getElementById("competitorName").value = "";
  document.getElementById("competitorUrl").value = "";
  document.getElementById("competitorStatus").checked = true;
  document.getElementById("competitorModalOverlay").classList.add("active");
}
function editCompetitor(id) {
  const comp = appState.competitors.find((c) => c.id === id);
  if (!comp) return;
  appState.editingCompetitor = comp;
  document.getElementById("competitorModalTitle").textContent = "Edit Competitor";
  document.getElementById("competitorName").value = comp.name;
  document.getElementById("competitorUrl").value = comp.changelog || comp.url;
  document.getElementById("competitorStatus").checked = comp.status === "active";
  document.getElementById("competitorModalOverlay").classList.add("active");
}
async function deleteCompetitor(id) {
  if (confirm('Are you sure you want to delete this competitor?')) {
    const response = await fetch(`/api/competitors/${id}`, { method: 'DELETE' });
    const result = await response.json();
    
    if (result.success) {
      appState.competitors = appState.competitors.filter(c => c.id !== id);
      appState.changes = appState.changes.filter(ch => ch.competitor !== id); // Ensure changes are updated
      renderCompetitors();
      renderChanges();
      renderDashboard();
      showToast(`Competitor deleted (removed ${result.removed_changes} changes).`);
    }
  }
}

function closeCompetitorModal() {
  document.getElementById("competitorModalOverlay").classList.remove("active");
  appState.editingCompetitor = null;
}
async function saveCompetitor(e) {
  e.preventDefault();
  const name = document.getElementById("competitorName").value.trim();
  const url = document.getElementById("competitorUrl").value.trim();
  const status = document.getElementById("competitorStatus").checked ? "active" : "paused";
  if (!name || !url) {
    showToast("Name and URL required.", "error");
    return;
  }
  try {
    if (appState.editingCompetitor) {
      const id = appState.editingCompetitor.id;
      const res = await API.updateCompetitor(id, { name, changelog: url, status });
      Object.assign(appState.editingCompetitor, res.competitor);
      showToast("Competitor updated.");
    } else {
      const res = await API.addCompetitor({ name, changelog: url, status });
      appState.competitors.push(res.competitor);
      showToast("Competitor added.");
    }
    closeCompetitorModal();
    renderCompetitors();
    renderDashboard();
  } catch (_) {}
}

/* ------------------------------------------------------------------ */
/* Search + Filters                                                     */
/* ------------------------------------------------------------------ */
function initSearch() {
  const searchInput = document.getElementById("competitorSearch");
  const competitorFilter = document.getElementById("competitorFilter");
  const dateFilter = document.getElementById("dateFilter");

  searchInput?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".competitor-card").forEach((card) => {
      const name = card.querySelector(".competitor-card__name").textContent.toLowerCase();
      const url = card.querySelector(".competitor-card__url").textContent.toLowerCase();
      card.style.display = name.includes(q) || url.includes(q) ? "block" : "none";
    });
  });

  competitorFilter?.addEventListener("change", applyChangeFilters);
  dateFilter?.addEventListener("change", applyChangeFilters);
}
function applyChangeFilters() {
  const compVal = document.getElementById("competitorFilter").value;
  const dateVal = document.getElementById("dateFilter").value;
  document.querySelectorAll(".change-item").forEach((item) => {
    const comp = item.querySelector(".change-item__competitor").textContent;
    const ts = item.querySelector(".change-item__timestamp").textContent;
    let show = true;
    if (compVal && comp !== compVal) show = false;
    if (dateVal) {
      const itemDate = new Date(ts);
      if (!itemDate || itemDate.toISOString().slice(0, 10) !== dateVal) show = false;
    }
    item.style.display = show ? "block" : "none";
  });
}

/* ------------------------------------------------------------------ */
/* Settings Save                                                        */
/* ------------------------------------------------------------------ */
async function saveApiSettings(e) {
  e.preventDefault();
  const slackWebhook = document.getElementById("slackWebhook").value.trim();
  const groqApiKey = document.getElementById("groqApiKey").value.trim();
  try {
    await API.updateSettings({ slackWebhook, groqApiKey });
    appState.settings.slack_webhook = slackWebhook;
    appState.settings.groq_api_key = groqApiKey;
    showToast("API settings saved.");
  } catch (_) {}
}
async function saveNotificationSettings(e) {
  e.preventDefault();
  const enabled = document.getElementById("notificationsEnabled").checked;
  const freq = parseInt(document.getElementById("checkFrequency").value, 10) || 60;
  try {
    await API.updateSettings({ notifications_enabled: enabled, check_frequency: freq });
    appState.settings.notifications_enabled = enabled;
    appState.settings.check_frequency = freq;
    showToast("Notification settings saved.");
    restartAutoRefresh();
  } catch (_) {}
}

/* ------------------------------------------------------------------ */
/* Manual Monitor Trigger                                               */
/* ------------------------------------------------------------------ */
async function runMonitor() {
  const btn = document.getElementById("manualTrigger");
  setLoading(btn, true, "Running...");
  try {
    const res = await API.runMonitor();
    if (res.success) {
      showToast(res.message || "Monitor run completed.");
    } else {
      showToast(res.error || "Monitor failed.", "error");
    }
    await refreshAllData(); // pull latest changes + stats
    // Jump to changes section if new results
    if (Object.keys(res.changes || {}).length) {
      document.querySelector('[data-section="changes"]').click();
    }
  } catch (err) {
    showToast("Monitor failed (see console).", "error");
  } finally {
    setLoading(btn, false);
  }
}

/* ------------------------------------------------------------------ */
/* Auto Refresh                                                         */
/* ------------------------------------------------------------------ */
async function refreshDashboardOnly() {
  try {
    const dash = await API.getDashboard();
    appState.dashboard_stats = dash;
    renderDashboard();
  } catch (_) {}
}
async function refreshAllData() {
  try {
    const [dash, comps, chgs, analytics] = await Promise.all([
      API.getDashboard(),
      API.getCompetitors(),
      API.getChanges(),     // default days=7
      API.getAnalytics()
    ]);

    appState.dashboard_stats = dash;
    appState.competitors = comps.competitors || [];
    appState.changes = chgs.changes || [];
    appState.analytics = {
      activity_data: analytics.weeklyActivity || [],
      top_competitors: (analytics.competitorActivity || []).map((c) => ({
        name: c.competitor,
        changes: c.changes
      }))
    };

    // Re-render current section (and dashboard counters)
    renderDashboard();
    loadSectionContent(appState.currentSection);
  } catch (err) {
    console.error("[REFRESH ERROR]", err);
  }
}
function startAutoRefresh() {
  stopAutoRefresh();
  const ms = (appState.settings.check_frequency || 60) * 1000;
  appState.refreshTimer = setInterval(refreshDashboardOnly, ms);
}
function stopAutoRefresh() {
  if (appState.refreshTimer) {
    clearInterval(appState.refreshTimer);
    appState.refreshTimer = null;
  }
}
function restartAutoRefresh() {
  stopAutoRefresh();
  startAutoRefresh();
}

/* ------------------------------------------------------------------ */
/* Sidebar Toggle (Mobile)                                             */
/* ------------------------------------------------------------------ */
function initSidebarToggle() {
  const mobileMenuToggle = document.getElementById("mobileMenuToggle");
  const sidebar = document.getElementById("sidebar");
  mobileMenuToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      sidebar?.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !mobileMenuToggle.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });
}

/* ------------------------------------------------------------------ */
/* Quick Actions                                                       */
/* ------------------------------------------------------------------ */
function initQuickActions() {
  document.getElementById("viewAllChanges")?.addEventListener("click", () => {
    document.querySelector('[data-section="changes"]').click();
  });
  document.getElementById("addCompetitorBtn")?.addEventListener("click", addCompetitor);
}

/* ------------------------------------------------------------------ */
/* DOM Ready                                                           */
/* ------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
  // Wire up UI
  initNavigation();
  initSidebarToggle();
  initSearch();
  initQuickActions();

  // Forms
  document.getElementById("competitorForm")?.addEventListener("submit", saveCompetitor);
  document.getElementById("apiSettingsForm")?.addEventListener("submit", saveApiSettings);
  document.getElementById("notificationSettingsForm")?.addEventListener("submit", saveNotificationSettings);
  document.getElementById("manualTrigger")?.addEventListener("click", runMonitor);

  // Modal controls
  document.getElementById("addCompetitorModal")?.addEventListener("click", addCompetitor);
  document.getElementById("competitorModalClose")?.addEventListener("click", closeCompetitorModal);
  document.getElementById("cancelCompetitor")?.addEventListener("click", closeCompetitorModal);
  document.getElementById("competitorModalOverlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCompetitorModal();
  });

  // Toast close
  document.getElementById("toastClose")?.addEventListener("click", () => {
    document.getElementById("toast").classList.remove("show");
  });

  // Initial settings fetch
  try {
    const settings = await API.getSettings();
    // Merge w/ local
    Object.assign(appState.settings, {
      slack_webhook: settings.slackWebhook,
      groq_api_key: settings.groqApiKey,
      notifications_enabled: true,
      check_frequency: 60
    });
  } catch (_) {}

  // Initial data pull + render
  await refreshAllData();

  // Activate default section
  loadSectionContent("dashboard");

  // Start periodic refresh
  startAutoRefresh();

  console.log("Competitor Monitor Dashboard initialized (live API mode).");
});
