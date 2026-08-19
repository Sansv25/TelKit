/* ============================================================
   settings.js — Handle Settings & Storage Statistics page
   ============================================================ */

const SettingsModule = (() => {

  function init() {
    // Modals
    const clearAllModal = document.getElementById('clearAllModal');
    const importModal = document.getElementById('importModal');
    let pendingImportFile = null;

    function showClearAllModal() { clearAllModal.classList.add('open'); }
    function hideClearAllModal() { clearAllModal.classList.remove('open'); }
    function showImportModal(file) { pendingImportFile = file; importModal.classList.add('open'); }
    function hideImportModal() { pendingImportFile = null; importModal.classList.remove('open'); }

    if (clearAllModal) {
      document.getElementById('clearAllModalClose').addEventListener('click', hideClearAllModal);
      document.getElementById('clearAllModalCancel').addEventListener('click', hideClearAllModal);
      document.getElementById('clearAllModalConfirm').addEventListener('click', async () => {
        hideClearAllModal();
        try {
          await Storage.clearAll();
          Toast.show('Semua data berhasil dihapus', 'success');
          render(); // refresh stats
        } catch (err) {
          console.error(err);
          Toast.show('Gagal menghapus data', 'error');
        }
      });
    }

    if (importModal) {
      document.getElementById('importModalClose').addEventListener('click', () => {
        hideImportModal();
        if(importInput) importInput.value = '';
      });
      document.getElementById('importModalCancel').addEventListener('click', () => {
        hideImportModal();
        if(importInput) importInput.value = '';
      });
      document.getElementById('importModalConfirm').addEventListener('click', () => {
        const fileToImport = pendingImportFile;
        hideImportModal();
        if(!fileToImport) return;

        try {
          if (importBtn) {
            importBtn.disabled = true;
            importBtn.innerHTML = '<span class="material-symbols-outlined btn-icon-left spin">refresh</span> Memproses...';
          }
          
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              await Storage.importAllData(ev.target.result);
              Toast.show('Backup berhasil diimport!', 'success');
              render();
            } catch (err) {
              console.error(err);
              Toast.show('Gagal import: ' + err.message, 'error');
            } finally {
              if (importBtn) {
                importBtn.disabled = false;
                importBtn.innerHTML = '<span class="material-symbols-outlined btn-icon-left">upload</span> Import Data';
              }
              if(importInput) importInput.value = '';
            }
          };
          reader.onerror = () => {
            Toast.show('Gagal membaca file', 'error');
            if (importBtn) {
              importBtn.disabled = false;
              importBtn.innerHTML = '<span class="material-symbols-outlined btn-icon-left">upload</span> Import Data';
            }
            if(importInput) importInput.value = '';
          };
          reader.readAsText(fileToImport);
        } catch (err) {
          console.error(err);
          Toast.show('Terjadi kesalahan saat import', 'error');
          if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = '<span class="material-symbols-outlined btn-icon-left">upload</span> Import Data';
          }
          if(importInput) importInput.value = '';
        }
      });
    }

    // Clear Database Button
    const clearBtn = document.getElementById('clearDatabaseBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        showClearAllModal();
      });
    }

    // Export Data Button
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          exportBtn.disabled = true;
          exportBtn.innerHTML = '<span class="material-symbols-outlined btn-icon-left spin">refresh</span> Menyiapkan...';
          
          const jsonStr = await Storage.exportAllData();
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `TELKIT_Backup_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          
          Toast.show('Backup berhasil didownload', 'success');
        } catch (err) {
          console.error(err);
          Toast.show('Gagal mengekspor data', 'error');
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<span class="material-symbols-outlined btn-icon-left">download</span> Export Data';
        }
      });
    }

    // Import Data Button
    const importBtn = document.getElementById('importDataBtn');
    const importInput = document.getElementById('importDataInput');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });

      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showImportModal(file);
      });
    }
  }

  async function render() {
    const usageText = document.getElementById('storageUsageText');
    const progressBar = document.getElementById('storageProgressBar');
    const tplCountText = document.getElementById('statsTemplateCount');
    const photoCountText = document.getElementById('statsPhotoCount');

    if (!usageText) return;

    usageText.textContent = 'Menghitung...';

    try {
      // 1. Get Storage Estimate from browser
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
        const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
        const percent = ((estimate.usage / estimate.quota) * 100).toFixed(1);
        
        usageText.textContent = `${usedMB} MB / ${quotaMB} MB (${percent}%)`;
        progressBar.style.width = `${percent}%`;
        
        // Color coding progress bar
        if (percent > 90) progressBar.style.background = 'var(--danger)';
        else if (percent > 70) progressBar.style.background = 'var(--warning)';
        else progressBar.style.background = 'var(--accent)';
      } else {
        usageText.textContent = 'API Storage tidak didukung di browser ini.';
      }

      // 2. Get Data Stats from IDB
      const stats = await Storage.getStats();
      tplCountText.textContent = stats.templateCount;
      photoCountText.textContent = stats.photoCount;

    } catch (err) {
      console.error(err);
      usageText.textContent = 'Gagal memuat statistik.';
    }
  }

  return { init, render };
})();
