/* ============================================================
   pwa.js — PWA installation & Service Worker registration
   ============================================================ */

const PWAModule = (() => {
  let deferredPrompt = null;

  function init() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('SW Registered:', reg.scope))
          .catch(err => console.error('SW Error:', err));
      });
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallButtons();
    });

    // Handle App Installed
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      hideInstallButtons();
      Toast.show('Aplikasi berhasil terinstall di perangkat Anda!', 'success');
    });

    // Wire up button click handlers
    const btnSidebar = document.getElementById('installPwaBtnSidebar');
    const btnSettings = document.getElementById('installPwaBtnSettings');

    if (btnSidebar) btnSidebar.addEventListener('click', triggerInstall);
    if (btnSettings) btnSettings.addEventListener('click', triggerInstall);
  }

  function showInstallButtons() {
    const btnSidebar = document.getElementById('installPwaBtnSidebar');
    const btnSettings = document.getElementById('installPwaBtnSettings');
    const settingsCard = document.getElementById('pwaSettingsCard');

    if (btnSidebar) btnSidebar.style.display = 'flex';
    if (btnSettings) btnSettings.style.display = 'inline-flex';
    if (settingsCard) settingsCard.style.display = 'block';
  }

  function hideInstallButtons() {
    const btnSidebar = document.getElementById('installPwaBtnSidebar');
    const btnSettings = document.getElementById('installPwaBtnSettings');
    const settingsCard = document.getElementById('pwaSettingsCard');

    if (btnSidebar) btnSidebar.style.display = 'none';
    if (btnSettings) btnSettings.style.display = 'none';
    if (settingsCard) settingsCard.style.display = 'none';
  }

  async function triggerInstall() {
    if (!deferredPrompt) {
      // If browser doesn't trigger beforeinstallprompt (e.g. desktop Chrome already installed or iOS), give instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert('Untuk meng-install di iPhone/iPad:\n1. Tekan tombol Share (Bagikan) di Safari.\n2. Pilih "Tambah ke Layar Utama" (Add to Home Screen).');
      } else {
        alert('Untuk meng-install web ini sebagai Aplikasi:\nKlik ikon titik tiga (⋮) atau ikon Install/Laptop di bilah alamat (address bar) browser Anda, lalu pilih "Install / Install Aplikasi".');
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('PWA prompt choice:', outcome);
    deferredPrompt = null;
    if (outcome === 'accepted') {
      hideInstallButtons();
    }
  }

  return { init, triggerInstall };
})();

document.addEventListener('DOMContentLoaded', PWAModule.init);
