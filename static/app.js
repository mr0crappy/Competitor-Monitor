/**
 * Competitor Monitor — frontend
 *
 * Talks to the Flask REST API, renders the dashboard, competitor list,
 * change history, analytics and settings.
 *
 * Structure: config → state → utils → normalizers → API → render → actions → init
 */

(() => {
  "use strict";

  /* ================================================================
   * Config
   * ================================================================ */

  const CONFIG = {
    REQUEST_TIMEOUT_MS: 15_000,
    TOAST_MS: 3_500,
    SEARCH_DEBOUNCE_MS: 150,
    DEFAULT_CHECK_FREQUENCY_MIN: 60,
    MIN_CHECK_FREQUENCY_MIN: 1,
  };

  const SECTION_TITLES = {
    dashboard: "Dashboard overview",
    competitors: "Competitors",
    changes: "Change history",
    analytics: "Analytics",
    settings: "Settings",
  };

  /* ================================================================
   * State
   * ================================================================ */

  const state = {
    currentSection: "dashboard",

    competitors: [],
    changes: [],

    analytics: {
      activity: [], // [{ date, changes }]
      ranking: [], // [{ name, changes }]
    },

    stats: {
      totalCompetitors: 0,
      activeCompetitors: 0,
      recentChanges24h: 0,
      lastRun: null,
      isRunning: false,
    },

    settings: {
      discordWebhook: "",
      hasGroqKey: false, // the key itself never lives in the client
      notificationsEnabled: true,
      checkFrequency: CONFIG.DEFAULT_CHECK_FREQUENCY_MIN,
      backendUrl: window.location.origin,
    },

    filters: {
      competitorSearch: "",
      changeCompetitor: "",
      changeDate: "",
    },

    editingCompetitorId: null,
  };

  /** Chart.js instance. Kept in module scope — `window.activityChart`
   *  collides with the canvas element of the same id. */
  let activityChart = null;

  let refreshTimer = null;
  let toastTimer = null;

  /* ================================================================
   * Utils
   * ================================================================ */

  const el = (id) => document.getElementById(id);
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function fmtDate(value) {
    const date = parseDate(value);
    if (!date) return "—";

    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  function fmtTime(value) {
    const date = parseDate(value);
    if (!date) return "—";

    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /** YYYY-MM-DD in local time, to match `<input type="date">`. */
  function toDateInputValue(value) {
    const date = parseDate(value);
    if (!date) return "";

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  const HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
  }

  /** Only http(s) links are rendered — blocks `javascript:` payloads
   *  coming back from the API or from a mistyped competitor URL. */
  function safeUrl(value) {
    if (!value) return "";

    try {
      const url = new URL(String(value), window.location.origin);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  }

  function showToast(message, type = "info") {
    const toast = el("toast");
    const label = el("toastMessage");

    if (!toast || !label) {
      (type === "error" ? console.error : console.log)(`[${type}] ${message}`);
      return;
    }

    label.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), CONFIG.TOAST_MS);
  }

  const SPINNER = `
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"
         class="spinner" aria-hidden="true">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
  `;

  function setLoading(button, isLoading, loadingLabel = "Working…") {
    if (!button) return;

    if (isLoading) {
      if (button.dataset.idleLabel === undefined) {
        button.dataset.idleLabel = button.innerHTML;
      }
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.innerHTML = `${SPINNER}${escapeHtml(loadingLabel)}`;
      return;
    }

    button.disabled = false;
    button.removeAttribute("aria-busy");

    if (button.dataset.idleLabel !== undefined) {
      button.innerHTML = button.dataset.idleLabel;
    }
  }

  function renderEmptyState(container, message) {
    container.innerHTML = `<div class="empty-state"><p>${escapeHtml(message)}</p></div>`;
  }

  /* ================================================================
   * Normalizers
   *
   * The API mixes snake_case and camelCase. Normalize once here so the
   * render and action code reads one shape only.
   * ================================================================ */

  function normalizeCompetitor(raw = {}) {
    return {
      id: raw.id,
      name: raw.name ?? "Untitled",
      url: raw.changelog ?? raw.url ?? "",
      description: raw.description ?? "",
      sourceType: raw.source_type ?? raw.sourceType ?? "generic",
      status: raw.status === "active" ? "active" : "paused",
      lastChecked: raw.last_checked ?? raw.lastUpdate ?? null,
      changeCount: raw.change_count ?? raw.changesDetected ?? 0,
    };
  }

  function normalizeChange(raw = {}) {
    return {
      competitor: raw.competitor ?? "Unknown",
      timestamp: raw.timestamp ?? null,
      summary: raw.summary ?? raw.change ?? "",
      details: Array.isArray(raw.changes) ? raw.changes : [],
    };
  }

  function normalizeStats(raw = {}) {
    return {
      totalCompetitors: raw.totalCompetitors ?? raw.total_competitors ?? 0,
      activeCompetitors: raw.activeCompetitors ?? raw.active_competitors ?? 0,
      recentChanges24h: raw.recentChanges24h ?? raw.recent_changes ?? 0,
      lastRun: raw.systemStatus?.lastRun ?? raw.last_check ?? null,
      isRunning: Boolean(raw.systemStatus?.isRunning ?? raw.is_running ?? false),
    };
  }

  function normalizeAnalytics(raw = {}) {
    const activity = raw.weeklyActivity ?? raw.activity_data ?? [];
    const ranking = raw.competitorActivity ?? raw.top_competitors ?? [];

    return {
      activity: activity.map((entry) => ({
        date: entry.date,
        changes: Number(entry.changes) || 0,
      })),
      ranking: ranking.map((entry) => ({
        name: entry.competitor ?? entry.name ?? "Unknown",
        changes: Number(entry.changes) || 0,
      })),
    };
  }

  function toCompetitorPayload(competitor) {
    return {
      name: competitor.name,
      changelog: competitor.url,
      description: competitor.description ?? "",
      source_type: competitor.sourceType,
      status: competitor.status,
    };
  }

  /* ================================================================
   * API client
   * ================================================================ */

  class ApiError extends Error {
    constructor(message, { status = 0, body = "" } = {}) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  }

  async function apiFetch(
  path,
  { method = "GET", body, signal, timeoutMs = CONFIG.REQUEST_TIMEOUT_MS } = {},
) {
    const base = state.settings.backendUrl.replace(/\/+$/, "");
    const url = `${base}${path}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new ApiError(
          `The server returned ${response.status} ${response.statusText}.`,
          { status: response.status, body: text },
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      return contentType.includes("application/json") ? response.json() : {};
    } catch (error) {
      const friendly =
        error.name === "AbortError"
          ? "The request timed out. Check that the backend is running."
          : error instanceof ApiError
            ? error.message
            : "Can't reach the backend.";

      console.error(`[api] ${method} ${url}`, error);
      showToast(friendly, "error");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const API = {
    getDashboard: () => apiFetch("/api/dashboard"),
    getStatus: () => apiFetch("/api/status"),
    getAnalytics: () => apiFetch("/api/analytics"),

    getCompetitors: () => apiFetch("/api/competitors"),
    addCompetitor: (payload) =>
      apiFetch("/api/competitors", { method: "POST", body: payload }),
    updateCompetitor: (id, payload) =>
      apiFetch(`/api/competitors/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: payload,
      }),
    deleteCompetitor: (id) =>
      apiFetch(`/api/competitors/${encodeURIComponent(id)}`, { method: "DELETE" }),

    getChanges: (filters = {}) => {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value != null),
      );
      const query = params.toString();
      return apiFetch(`/api/changes${query ? `?${query}` : ""}`);
    },

    runMonitor: () =>
  apiFetch("/api/run-monitor", {
    method: "POST",
    timeoutMs: 120_000,
  }),

    getSettings: () => apiFetch("/api/settings"),
    updateSettings: (payload) =>
      apiFetch("/api/settings", { method: "POST", body: payload }),
  };

  /* ================================================================
   * Render — dashboard
   * ================================================================ */

  function renderDashboard() {
    const { stats } = state;

    const total = el("totalCompetitors");
    const active = el("activeCompetitors");
    const recent = el("recentChanges");
    const lastCheck = el("lastCheck");

    if (total) total.textContent = stats.totalCompetitors;
    if (active) active.textContent = stats.activeCompetitors;
    if (recent) recent.textContent = stats.recentChanges24h;
    if (lastCheck) lastCheck.textContent = fmtTime(stats.lastRun);

    const statusWrap = el("systemStatus");
    if (!statusWrap) return;

    const text = qs(".status-text", statusWrap);
    const dot = qs(".status-dot", statusWrap);

    if (text) text.textContent = stats.isRunning ? "Running…" : "Idle";
    if (dot) {
      dot.style.background = stats.isRunning
        ? "var(--color-warning)"
        : "var(--color-success)";
    }
  }

  /* ================================================================
   * Render — competitors
   * ================================================================ */

  function visibleCompetitors() {
    const query = state.filters.competitorSearch.toLowerCase();
    if (!query) return state.competitors;

    return state.competitors.filter(
      (competitor) =>
        competitor.name.toLowerCase().includes(query) ||
        competitor.url.toLowerCase().includes(query),
    );
  }

  function competitorCardMarkup(competitor) {
    const href = safeUrl(competitor.url);
    const isActive = competitor.status === "active";

    const link = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
            class="competitor-card__url">${escapeHtml(competitor.url)}</a>`
      : `<span class="competitor-card__url">${escapeHtml(competitor.url)}</span>`;

    return `
      <div class="competitor-card__header">
        <div>
          <h3 class="competitor-card__name">${escapeHtml(competitor.name)}</h3>
          ${link}
        </div>
        <span class="status ${isActive ? "status--success" : "status--warning"}">
          ${isActive ? "Active" : "Paused"}
        </span>
      </div>

      <div class="competitor-card__info">
        <div class="info-item">
          <p class="info-item__label">Source</p>
          <p class="info-item__value">${escapeHtml(competitor.sourceType)}</p>
        </div>
        <div class="info-item">
          <p class="info-item__label">Last checked</p>
          <p class="info-item__value">${escapeHtml(fmtTime(competitor.lastChecked))}</p>
        </div>
        <div class="info-item">
          <p class="info-item__label">Changes</p>
          <p class="info-item__value">${escapeHtml(competitor.changeCount)}</p>
        </div>
      </div>

      <div class="competitor-card__actions">
        <button class="btn btn--sm btn--outline" data-action="edit">Edit</button>
        <button class="btn btn--sm btn--outline" data-action="toggle">
          ${isActive ? "Pause" : "Activate"}
        </button>
        <button class="btn btn--sm btn--outline" data-action="delete">Delete</button>
      </div>
    `;
  }

  function renderCompetitors() {
    const grid = el("competitorsGrid");
    if (!grid) return;

    const competitors = visibleCompetitors();
    grid.innerHTML = "";

    if (!competitors.length) {
      renderEmptyState(
        grid,
        state.competitors.length
          ? "No competitors match that search."
          : "Add a competitor to start tracking changes.",
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const competitor of competitors) {
      const card = document.createElement("div");
      card.className = "competitor-card";
      card.dataset.id = String(competitor.id);
      card.innerHTML = competitorCardMarkup(competitor);
      fragment.appendChild(card);
    }

    grid.appendChild(fragment);
  }

  /* ================================================================
   * Render — changes
   * ================================================================ */

  function visibleChanges() {
    const { changeCompetitor, changeDate } = state.filters;

    return state.changes.filter((change) => {
      if (changeCompetitor && change.competitor !== changeCompetitor) return false;
      if (changeDate && toDateInputValue(change.timestamp) !== changeDate) return false;
      return true;
    });
  }

  function renderCompetitorFilterOptions() {
    const filter = el("competitorFilter");
    if (!filter) return;

    const selected = state.filters.changeCompetitor;
    const names = [...new Set(state.competitors.map((c) => c.name))].sort();

    filter.innerHTML = `<option value="">All competitors</option>`;

    for (const name of names) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      filter.appendChild(option);
    }

    filter.value = names.includes(selected) ? selected : "";
    state.filters.changeCompetitor = filter.value;
  }

  function renderChanges() {
    const container = el("changesList");
    if (!container) return;

    renderCompetitorFilterOptions();

    const changes = visibleChanges();
    container.innerHTML = "";

    if (!changes.length) {
      renderEmptyState(
        container,
        state.changes.length
          ? "No changes match these filters."
          : "No changes detected yet. Run the monitor to check now.",
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const change of changes) {
      const details = change.details.length
        ? `<ul class="change-item__details">${change.details
            .map((detail) => `<li>${escapeHtml(detail)}</li>`)
            .join("")}</ul>`
        : "";

      const item = document.createElement("div");
      item.className = "change-item";
      item.innerHTML = `
        <div class="change-item__header">
          <div class="change-item__meta">
            <span class="change-item__competitor">${escapeHtml(change.competitor)}</span>
            <time class="change-item__timestamp" datetime="${escapeHtml(change.timestamp ?? "")}">
              ${escapeHtml(fmtDate(change.timestamp))}
            </time>
          </div>
        </div>
        <p class="change-item__summary">
          ${escapeHtml(change.summary || "No summary available.")}
        </p>
        ${details}
      `;

      fragment.appendChild(item);
    }

    container.appendChild(fragment);
  }

  /* ================================================================
   * Render — analytics
   * ================================================================ */

  function renderActivityChart() {
    const canvas = el("activityChart");
    if (!canvas || typeof Chart === "undefined") return;

    const { activity } = state.analytics;

    const labels = activity.map((entry) => {
      const date = parseDate(entry.date);
      return date
        ? date.toLocaleDateString([], { month: "short", day: "numeric" })
        : String(entry.date ?? "");
    });

    const values = activity.map((entry) => entry.changes);

    if (activityChart) {
      activityChart.data.labels = labels;
      activityChart.data.datasets[0].data = values;
      activityChart.update();
      return;
    }

    const accent = cssVar("--color-primary", "#00D4FF");
    const textColor = cssVar("--color-text", "#FFFFFF");
    const mutedColor = cssVar("--color-text-secondary", "#B3B3B3");
    const gridColor = cssVar("--color-border", "#404040");

    activityChart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Changes",
            data: values,
            borderColor: accent,
            backgroundColor: "rgba(0, 212, 255, 0.10)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: { ticks: { color: mutedColor }, grid: { color: gridColor } },
          y: {
            beginAtZero: true,
            ticks: { color: mutedColor, precision: 0 },
            grid: { color: gridColor },
          },
        },
      },
    });
  }

  function renderCompetitorRanking() {
    const container = el("competitorRanking");
    if (!container) return;

    container.innerHTML = "";

    if (!state.analytics.ranking.length) {
      renderEmptyState(container, "Ranking appears once changes are recorded.");
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const entry of state.analytics.ranking) {
      const row = document.createElement("div");
      row.className = "ranking-item";
      row.innerHTML = `
        <span class="ranking-item__name">${escapeHtml(entry.name)}</span>
        <span class="ranking-item__count">${escapeHtml(entry.changes)}</span>
      `;
      fragment.appendChild(row);
    }

    container.appendChild(fragment);
  }

  function renderAnalytics() {
    renderActivityChart();
    renderCompetitorRanking();
  }

  /* ================================================================
   * Render — settings
   * ================================================================ */

  function renderSettings() {
    const discord = el("discordWebhook");
    const groq = el("groqApiKey");
    const notifications = el("notificationsEnabled");
    const frequency = el("checkFrequency");

    if (discord) discord.value = state.settings.discordWebhook;

    if (groq) {
      // Write-only: the stored key is never sent back to the browser.
      groq.value = "";
      groq.placeholder = state.settings.hasGroqKey
        ? "Saved — enter a new key to replace it"
        : "Enter your Groq API key";
    }

    if (notifications) notifications.checked = state.settings.notificationsEnabled;
    if (frequency) frequency.value = state.settings.checkFrequency;
  }

  /* ================================================================
   * Section loader + navigation
   * ================================================================ */

  const RENDERERS = {
    dashboard: renderDashboard,
    competitors: renderCompetitors,
    changes: renderChanges,
    analytics: renderAnalytics,
    settings: renderSettings,
  };

  function loadSection(section) {
    RENDERERS[section]?.();
  }

  function goToSection(section) {
    if (!SECTION_TITLES[section]) return;

    state.currentSection = section;

    for (const link of qsa(".nav-link")) {
      link.classList.toggle("active", link.dataset.section === section);
    }

    for (const node of qsa(".section")) {
      node.classList.toggle("active", node.id === section);
    }

    const title = el("pageTitle");
    if (title) title.textContent = SECTION_TITLES[section];

    loadSection(section);

    if (window.innerWidth <= 768) el("sidebar")?.classList.remove("open");
  }

  function initNavigation() {
    for (const link of qsa(".nav-link")) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        goToSection(link.dataset.section);
      });
    }
  }

  /* ================================================================
   * Actions — competitor modal
   * ================================================================ */

  function openCompetitorModal(competitor = null) {
    state.editingCompetitorId = competitor?.id ?? null;

    const title = el("competitorModalTitle");
    if (title) {
      title.textContent = competitor ? "Edit competitor" : "Add competitor";
    }

    el("competitorName").value = competitor?.name ?? "";
    el("competitorUrl").value = competitor?.url ?? "";
    el("competitorSourceType").value = competitor?.sourceType ?? "generic";
    el("competitorStatus").checked = competitor ? competitor.status === "active" : true;

    el("competitorModalOverlay")?.classList.add("active");
    el("competitorName")?.focus();
  }

  function closeCompetitorModal() {
    el("competitorModalOverlay")?.classList.remove("active");
    state.editingCompetitorId = null;
  }

  function findCompetitor(id) {
    return state.competitors.find((competitor) => String(competitor.id) === String(id));
  }

  async function saveCompetitor(event) {
    event.preventDefault();

    const submitButton = qs("button[type='submit']", event.currentTarget);

    const draft = {
      name: el("competitorName").value.trim(),
      url: el("competitorUrl").value.trim(),
      sourceType: el("competitorSourceType").value || "generic",
      status: el("competitorStatus").checked ? "active" : "paused",
      description: "",
    };

    if (!draft.name) {
      showToast("Enter a competitor name.", "error");
      el("competitorName").focus();
      return;
    }

    if (!safeUrl(draft.url)) {
      showToast("Enter a valid http or https URL.", "error");
      el("competitorUrl").focus();
      return;
    }

    setLoading(submitButton, true, "Saving…");

    try {
      const payload = toCompetitorPayload(draft);
      const editingId = state.editingCompetitorId;

      if (editingId !== null) {
        const response = await API.updateCompetitor(editingId, payload);
        const updated = normalizeCompetitor(response.competitor ?? { ...payload, id: editingId });
        const index = state.competitors.findIndex(
          (competitor) => String(competitor.id) === String(editingId),
        );
        if (index !== -1) state.competitors[index] = updated;
        showToast("Competitor updated.");
      } else {
        const response = await API.addCompetitor(payload);
        state.competitors.push(normalizeCompetitor(response.competitor ?? payload));
        showToast("Competitor added.");
      }

      closeCompetitorModal();
      await refreshAll();
    } catch {
      // apiFetch already surfaced the failure.
    } finally {
      setLoading(submitButton, false);
    }
  }

  async function toggleCompetitorStatus(id) {
    const competitor = findCompetitor(id);
    if (!competitor) return;

    const nextStatus = competitor.status === "active" ? "paused" : "active";

    try {
      const response = await API.updateCompetitor(
        competitor.id,
        toCompetitorPayload({ ...competitor, status: nextStatus }),
      );

      Object.assign(
        competitor,
        normalizeCompetitor(response.competitor ?? { ...competitor, status: nextStatus }),
      );

      renderCompetitors();
      renderDashboard();
      showToast(nextStatus === "active" ? "Competitor activated." : "Competitor paused.");
    } catch {
      // apiFetch already surfaced the failure.
    }
  }

  async function deleteCompetitor(id) {
    const competitor = findCompetitor(id);
    if (!competitor) return;

    if (!window.confirm(`Delete ${competitor.name} and its change history?`)) return;

    try {
      const result = await API.deleteCompetitor(competitor.id);
      if (result.success === false) return;

      state.competitors = state.competitors.filter(
        (item) => String(item.id) !== String(competitor.id),
      );
      state.changes = state.changes.filter(
        (change) => change.competitor !== competitor.name,
      );

      renderCompetitors();
      renderChanges();
      renderDashboard();

      showToast(
        result.removed_changes === undefined
          ? "Competitor deleted."
          : `Competitor deleted, along with ${result.removed_changes} changes.`,
      );
    } catch {
      // apiFetch already surfaced the failure.
    }
  }

  function initCompetitorGrid() {
    const grid = el("competitorsGrid");
    if (!grid) return;

    grid.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const id = button.closest(".competitor-card")?.dataset.id;
      if (!id) return;

      const competitor = findCompetitor(id);

      if (button.dataset.action === "edit" && competitor) openCompetitorModal(competitor);
      if (button.dataset.action === "toggle") toggleCompetitorStatus(id);
      if (button.dataset.action === "delete") deleteCompetitor(id);
    });
  }

  function initCompetitorModal() {
    el("competitorForm")?.addEventListener("submit", saveCompetitor);
    el("addCompetitorBtn")?.addEventListener("click", () => openCompetitorModal());
    el("addCompetitorModal")?.addEventListener("click", () => openCompetitorModal());
    el("competitorModalClose")?.addEventListener("click", closeCompetitorModal);
    el("cancelCompetitor")?.addEventListener("click", closeCompetitorModal);

    el("competitorModalOverlay")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeCompetitorModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCompetitorModal();
    });
  }

  /* ================================================================
   * Actions — filters
   * ================================================================ */

  function initFilters() {
    el("competitorSearch")?.addEventListener(
      "input",
      debounce((event) => {
        state.filters.competitorSearch = event.target.value.trim();
        renderCompetitors();
      }, CONFIG.SEARCH_DEBOUNCE_MS),
    );

    el("competitorFilter")?.addEventListener("change", (event) => {
      state.filters.changeCompetitor = event.target.value;
      renderChanges();
    });

    el("dateFilter")?.addEventListener("change", (event) => {
      state.filters.changeDate = event.target.value;
      renderChanges();
    });
  }

  /* ================================================================
   * Actions — settings
   * ================================================================ */

  async function saveApiSettings(event) {
    event.preventDefault();

    const button = qs("button[type='submit']", event.currentTarget);
    const discordWebhook = el("discordWebhook")?.value.trim() ?? "";
    const groqApiKey = el("groqApiKey")?.value.trim() ?? "";

    if (discordWebhook && !safeUrl(discordWebhook)) {
      showToast("Enter a valid Discord webhook URL.", "error");
      return;
    }

    const payload = { discordWebhook };
    if (groqApiKey) payload.groqApiKey = groqApiKey; // omit to keep the stored key

    setLoading(button, true, "Saving…");

    try {
      await API.updateSettings(payload);

      state.settings.discordWebhook = discordWebhook;
      if (groqApiKey) state.settings.hasGroqKey = true;

      renderSettings();
      showToast("Connection settings saved.");
    } catch {
      // apiFetch already surfaced the failure.
    } finally {
      setLoading(button, false);
    }
  }

  async function saveNotificationSettings(event) {
    event.preventDefault();

    const button = qs("button[type='submit']", event.currentTarget);
    const enabled = Boolean(el("notificationsEnabled")?.checked);
    const frequency = Math.max(
      CONFIG.MIN_CHECK_FREQUENCY_MIN,
      Number.parseInt(el("checkFrequency")?.value, 10) || CONFIG.DEFAULT_CHECK_FREQUENCY_MIN,
    );

    setLoading(button, true, "Saving…");

    try {
      await API.updateSettings({
        notifications_enabled: enabled,
        check_frequency: frequency,
      });

      state.settings.notificationsEnabled = enabled;
      state.settings.checkFrequency = frequency;

      renderSettings();
      restartAutoRefresh();
      showToast("Notification settings saved.");
    } catch {
      // apiFetch already surfaced the failure.
    } finally {
      setLoading(button, false);
    }
  }

  function initSettingsForms() {
    el("apiSettingsForm")?.addEventListener("submit", saveApiSettings);
    el("notificationSettingsForm")?.addEventListener("submit", saveNotificationSettings);
  }

  /* ================================================================
   * Actions — monitor run
   * ================================================================ */

  async function runMonitor() {
    const button = el("manualTrigger");
    setLoading(button, true, "Running…");

    try {
      const result = await API.runMonitor();

      if (result.success === false) {
        showToast(result.error || "The monitor run failed.", "error");
      } else {
        showToast(result.message || "Monitor run finished.");
      }

      await refreshAll();

      if (Object.keys(result.changes ?? {}).length) goToSection("changes");
    } catch {
      // apiFetch already surfaced the failure.
    } finally {
      setLoading(button, false);
    }
  }

  /* ================================================================
   * Data loading + auto refresh
   * ================================================================ */

  async function loadSettings() {
    try {
      const settings = await API.getSettings();

      state.settings.discordWebhook = settings.discordWebhook ?? settings.discord_webhook ?? "";
      state.settings.hasGroqKey = Boolean(
        settings.hasGroqKey ?? settings.groq_api_key_set ?? settings.groqApiKey,
      );
      state.settings.notificationsEnabled =
        settings.notifications_enabled ?? settings.notificationsEnabled ?? true;
      state.settings.checkFrequency =
        Number(settings.check_frequency ?? settings.checkFrequency) ||
        CONFIG.DEFAULT_CHECK_FREQUENCY_MIN;
    } catch {
      // Defaults already in state.
    }
  }

  /** Cheap poll used by the timer — stats only. */
  async function refreshStats() {
    try {
      state.stats = normalizeStats(await API.getDashboard());
      renderDashboard();
    } catch {
      // Keep the last known values on screen.
    }
  }

  async function refreshAll() {
    const results = await Promise.allSettled([
      API.getDashboard(),
      API.getCompetitors(),
      API.getChanges(),
      API.getAnalytics(),
    ]);

    const [dashboard, competitors, changes, analytics] = results.map((result) =>
      result.status === "fulfilled" ? result.value : null,
    );

    if (dashboard) state.stats = normalizeStats(dashboard);
    if (competitors) {
      state.competitors = (competitors.competitors ?? []).map(normalizeCompetitor);
    }
    if (changes) state.changes = (changes.changes ?? []).map(normalizeChange);
    if (analytics) state.analytics = normalizeAnalytics(analytics);

    renderDashboard();
    loadSection(state.currentSection);
  }

  function startAutoRefresh() {
    stopAutoRefresh();

    const minutes = state.settings.checkFrequency || CONFIG.DEFAULT_CHECK_FREQUENCY_MIN;
    refreshTimer = setInterval(refreshStats, minutes * 60 * 1000);
  }

  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function restartAutoRefresh() {
    startAutoRefresh();
  }

  function initVisibilityHandling() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAutoRefresh();
      } else {
        refreshStats();
        startAutoRefresh();
      }
    });
  }

  /* ================================================================
   * Chrome — sidebar, toast, quick actions
   * ================================================================ */

  function initSidebar() {
    const toggle = el("mobileMenuToggle");
    const sidebar = el("sidebar");

    toggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      sidebar?.classList.toggle("open");
    });

    document.addEventListener("click", (event) => {
      if (window.innerWidth > 768) return;
      if (!sidebar?.classList.contains("open")) return;
      if (sidebar.contains(event.target) || toggle?.contains(event.target)) return;

      sidebar.classList.remove("open");
    });
  }

  function initToast() {
    el("toastClose")?.addEventListener("click", () => {
      clearTimeout(toastTimer);
      el("toast")?.classList.remove("show");
    });
  }

  function initQuickActions() {
    el("viewAllChanges")?.addEventListener("click", () => goToSection("changes"));
    el("manualTrigger")?.addEventListener("click", runMonitor);
  }

  /* ================================================================
   * Boot
   * ================================================================ */

  async function init() {
    initNavigation();
    initSidebar();
    initFilters();
    initQuickActions();
    initCompetitorModal();
    initCompetitorGrid();
    initSettingsForms();
    initToast();
    initVisibilityHandling();

    await loadSettings();
    await refreshAll();

    goToSection("dashboard");
    startAutoRefresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();