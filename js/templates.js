/* ============================================================
   templates.js — Template list page rendering
   ============================================================ */

const TemplatesModule = (() => {
  let pendingDeleteId = null;

  /**
   * Initialize template list page
   */
  function init() {
    // Delete modal events
    document.getElementById('deleteModalClose').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteModalCancel').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteModalConfirm').addEventListener('click', confirmDelete);

    // Close modal on overlay click
    document.getElementById('deleteModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeDeleteModal();
    });
  }

  /**
   * Render the template list
   */
  async function render() {
    const container = document.getElementById('templateList');
    container.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Memuat template...</div>';

    try {
      const templates = await Storage.getTemplates();

      if (templates.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><span class="material-symbols-outlined" style="font-size:inherit">folder_off</span></div>
            <h3>Belum ada template</h3>
            <p>Import file Excel checklist housekeeping untuk membuat template pertama Anda.</p>
            <a href="#import" class="btn btn-primary btn-lg"><span class="material-symbols-outlined btn-icon-left">upload_file</span> Import Excel</a>
          </div>
        `;
        return;
      }

      let html = '<div class="card-grid">';

      templates.forEach((tpl) => {
        // Check if template is a copy
        const isCopy = tpl.isCopied || (tpl.sheetName && tpl.sheetName.includes('(Salinan)'));
        const cardStyle = isCopy ? 'border-top: 3px solid #ef4444;' : '';
        const iconColor = isCopy ? '#f87171' : 'var(--accent)';
        const badgeHtml = isCopy 
          ? `<span style="background:rgba(239, 68, 68, 0.15); color:#f87171; border:1px solid rgba(239, 68, 68, 0.3); font-size:10px; font-weight:600; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px; margin-left:auto;"><span class="material-symbols-outlined" style="font-size:12px;">content_copy</span> Salinan</span>` 
          : '';

        html += `
          <div class="card" id="card-${tpl.templateId}" style="${cardStyle}">
            <div class="card-title" style="display:flex; align-items:center; width:100%;">
              <div style="display:flex; align-items:center; gap:6px; flex:1; overflow:hidden; min-width:0;">
                <span class="material-symbols-outlined" style="color:${iconColor}">table_chart</span> 
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_escapeHtml(tpl.sheetName)}</span>
              </div>
              ${badgeHtml}
            </div>
            <div class="card-meta">
              <span class="card-meta-item"><span class="material-symbols-outlined">description</span> ${_escapeHtml(tpl.fileName)}</span>
              <span class="card-meta-item"><span class="material-symbols-outlined">checklist</span> ${tpl.rows.length} aktivitas</span>
              <span class="card-meta-item"><span class="material-symbols-outlined">bar_chart</span> Kelas: ${_escapeHtml(tpl.kelasColumns.join(', '))}</span>
            </div>
            <div class="text-xs text-muted" style="margin-bottom:4px;">
              Dibuat: ${_formatDate(tpl.createdAt)}
            </div>
            <div class="card-actions">
              <a href="#editor?id=${tpl.templateId}" class="btn btn-primary btn-sm" style="flex:1;">
                <span class="material-symbols-outlined btn-icon-left">photo_camera</span> Buka & Input Foto
              </a>
              <button class="btn btn-danger btn-sm btn-icon" onclick="TemplatesModule.openDeleteModal('${tpl.templateId}')" title="Hapus template">
                <span class="material-symbols-outlined" style="font-size:1.125rem">delete</span>
              </button>
            </div>
          </div>
        `;
      });

      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      console.error(err);
      container.innerHTML = '<div style="color:var(--danger); padding:2rem; text-align:center;">Gagal memuat template.</div>';
    }
  }

  /**
   * Open delete confirmation modal
   * @param {string} templateId
   */
  function openDeleteModal(templateId) {
    pendingDeleteId = templateId;
    const tpl = Storage.getTemplate(templateId);
    if (!tpl) return;

    document.getElementById('deleteTemplateName').textContent = tpl.sheetName;
    document.getElementById('deleteModal').classList.add('open');
  }

  /**
   * Close delete modal
   */
  function closeDeleteModal() {
    pendingDeleteId = null;
    document.getElementById('deleteModal').classList.remove('open');
  }

  /**
   * Confirm template deletion
   */
  async function confirmDelete() {
    if (!pendingDeleteId) return;
    try {
      await Storage.deleteTemplate(pendingDeleteId);
      Toast.show('Template berhasil dihapus', 'success');
      closeDeleteModal();
      await render(); // re-render list
    } catch (err) {
      Toast.show('Gagal menghapus template', 'error');
    }
  }

  /**
   * Format ISO date to locale string
   * @private
   */
  function _formatDate(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  }

  /**
   * Escape HTML
   * @private
   */
  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  return {
    init,
    render,
    openDeleteModal
  };
})();
