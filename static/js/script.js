// Competitor Monitor Dashboard JavaScript

class CompetitorMonitor {
    constructor() {
        this.baseURL = window.location.origin;
        this.competitors = [];
        this.changes = [];
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.setupMobileMenu();
    }

    async apiCall(endpoint, options = {}) {
        const url = `${this.baseURL}/api${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API call failed for ${endpoint}:`, error);
            this.showToast('API Error', error.message, 'error');
            throw error;
        }
    }

    async runMonitor() {
        this.showLoading(true);
        try {
            const result = await this.apiCall('/run-monitor', { method: 'POST' });
            this.showToast('Monitor Complete', 'Competitor monitoring completed successfully', 'success');
            this.loadDashboardData();
            return result;
        } catch (error) {
            this.showToast('Monitor Failed', 'Failed to run competitor monitoring', 'error');
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
        this.isLoading = show;
    }

    showToast(title, message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${title} - ${message}`);
        // Simple console-based toast for now
    }

    setupEventListeners() {
        // Run monitor button
        const runBtn = document.getElementById('runMonitorBtn');
        if (runBtn) {
            runBtn.addEventListener('click', () => this.runMonitor());
        }

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
            });
        });
    }

    setupMobileMenu() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
        }
    }

    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');

        // Update title
        const titles = {
            dashboard: 'Dashboard',
            competitors: 'Competitor Management',
            changes: 'Change History',
            analytics: 'Analytics & Insights',
            settings: 'Settings'
        };
        const titleElement = document.getElementById('sectionTitle');
        if (titleElement) {
            titleElement.textContent = titles[sectionName];
        }
    }

    async loadDashboardData() {
        try {
            const data = await this.apiCall('/dashboard');
            
            const elements = {
                totalCompetitors: document.getElementById('totalCompetitors'),
                recentChanges: document.getElementById('recentChanges'),
                lastUpdate: document.getElementById('lastUpdate'),
                systemStatus: document.getElementById('systemStatus')
            };

            if (elements.totalCompetitors) {
                elements.totalCompetitors.textContent = data.total_competitors || 0;
            }
            if (elements.recentChanges) {
                elements.recentChanges.textContent = data.recent_changes || 0;
            }
            if (elements.lastUpdate) {
                elements.lastUpdate.textContent = data.last_update || 'Never';
            }
            if (elements.systemStatus) {
                elements.systemStatus.textContent = data.status || 'Online';
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }

    async loadInitialData() {
        await this.loadDashboardData();
        
        // Update status every 30 seconds
        setInterval(() => {
            this.loadDashboardData();
        }, 30000);
    }
}

// Global functions
window.showSection = function(section) {
    if (window.competitorMonitor) {
        window.competitorMonitor.showSection(section);
    }
};

window.runManualMonitor = function() {
    if (window.competitorMonitor) {
        window.competitorMonitor.runMonitor();
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.competitorMonitor = new CompetitorMonitor();
});