/* ============================================================
   app.js — SPA Router, Global State, Initialization
   ============================================================ */

// Storage has been migrated to IndexedDB (storage.js)

// ===== Toast Notification System =====
const Toast = (() => {
  /**
   * Show a toast notification
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration - ms before auto-dismiss
   */
  function show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');

    const icons = {
      success: '<span class="material-symbols-outlined" style="color:var(--success)">check_circle</span>',
      error: '<span class="material-symbols-outlined" style="color:var(--danger)">error</span>',
      warning: '<span class="material-symbols-outlined" style="color:var(--warning)">warning</span>',
      info: '<span class="material-symbols-outlined" style="color:var(--info)">info</span>'
    };

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto-dismiss
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  return { show };
})();

// ===== Router =====
const Router = (() => {
  const pages = ['import', 'templates', 'editor'];

  /**
   * Initialize the router
   */
  function init() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute(); // handle initial route
  }

  /**
   * Handle hash route change
   */
  async function handleRoute() {
    const hash = window.location.hash.slice(1) || 'templates';
    const [pageName, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString || '');

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const navItem = document.getElementById(`nav-${pageName}`);
    if (navItem) navItem.classList.add('active');

    // Show target page
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
      page.style.display = 'block';
    } else {
      window.location.hash = '#templates';
      return;
    }

    // Page specific logic
    switch (pageName) {
      case 'templates':
        TemplatesModule.render();
        document.getElementById('nav-editor').style.display = 'none';
        break;

      case 'editor':
        const templateId = params.get('id');
        if (templateId) {
          EditorModule.load(templateId);
        } else {
          window.location.hash = '#templates';
        }
        break;

      case 'settings':
        document.getElementById('nav-editor').style.display = 'none';
        if (typeof SettingsModule !== 'undefined') SettingsModule.render();
        break;

      case 'import':
        document.getElementById('nav-editor').style.display = 'none';
        break;
    }

    // Close mobile sidebar
    closeMobileSidebar();
  }

  return { init, handleRoute };
})();

// ===== Mobile Sidebar =====
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuBtn = document.getElementById('mobileMenuBtn');

  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('open', isOpen);

  if (menuBtn) {
    menuBtn.style.display = isOpen ? 'none' : '';
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuBtn = document.getElementById('mobileMenuBtn');

  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  if (menuBtn) {
    menuBtn.style.display = '';
  }
}

// ===== App Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
  // Init DB
  try {
    await Storage.initDB();
  } catch (err) {
    Toast.show('Gagal inisialisasi database lokal', 'error');
  }

  // Init modules
  ImportModule.init();
  TemplatesModule.init();
  EditorModule.init();
  if (typeof ExportModule !== 'undefined' && ExportModule.init) ExportModule.init();
  if (typeof SettingsModule !== 'undefined') SettingsModule.init();

  // Mobile menu
  document.getElementById('mobileMenuBtn').addEventListener('click', toggleMobileSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  }

  // Theme toggle logic
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const themeToggleText = document.getElementById('themeToggleText');

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if(themeToggleIcon) themeToggleIcon.textContent = 'dark_mode';
      if(themeToggleText) themeToggleText.textContent = 'Dark Mode';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if(themeToggleIcon) themeToggleIcon.textContent = 'light_mode';
      if(themeToggleText) themeToggleText.textContent = 'Light Mode';
    }
  }

  // Load saved theme
  const savedTheme = localStorage.getItem('themePreference') || 'dark';
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const newTheme = isLight ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('themePreference', newTheme);
    });
  }

  // Start router
  Router.init();
});
