/* ============================================================
   editor.js — Photo input table with drag-drop upload
   Photos stored in RAM only (window.photoStore)
   ============================================================ */

const EditorModule = (() => {
  let currentTemplate = null;
  let currentPhotos = {};
  let currentDragPhoto = null; // Tracks internally dragged photo

  /**
   * Initialize editor — called once on app start
   */
  function init() {
    // Export PDF button
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
      if (!currentTemplate) return;
      ExportModule.exportPDF(currentTemplate);
    });

    // Clear All Photos button
    document.getElementById('clearPhotosBtn').addEventListener('click', () => {
      if (!currentTemplate) return;
      
      const photoKeys = Object.keys(currentPhotos);
      if (photoKeys.length === 0) {
        Toast.show('Belum ada foto yang disimpan di template ini.', 'warning');
        return;
      }

      document.getElementById('deletePhotosModal').classList.add('open');
    });

    // Close Delete Photos Modal
    const closeDeletePhotosModal = () => {
      document.getElementById('deletePhotosModal').classList.remove('open');
    };
    document.getElementById('deletePhotosModalClose').addEventListener('click', closeDeletePhotosModal);
    document.getElementById('deletePhotosModalCancel').addEventListener('click', closeDeletePhotosModal);

    // Confirm Delete Photos
    document.getElementById('deletePhotosModalConfirm').addEventListener('click', async () => {
      closeDeletePhotosModal();
      try {
        const photoKeys = Object.keys(currentPhotos);
        const tplId = currentTemplate.templateId;
        // Delete sequentially to avoid blocking IDB too heavily if many photos
        for (const key of photoKeys) {
          const [rowId, slot] = key.split('_');
          await Storage.deletePhoto(tplId, rowId, slot);
        }
        currentPhotos = {};
        renderTable();
        Toast.show('Semua foto berhasil dihapus', 'success');
      } catch (err) {
        console.error(err);
        Toast.show('Terjadi kesalahan saat menghapus foto', 'error');
      }
    });

    // Save As / Duplicate Template Button
    const saveAsModal = document.getElementById('saveAsModal');
    const saveAsNameInput = document.getElementById('saveAsNameInput');
    const saveAsIncludePhotos = document.getElementById('saveAsIncludePhotos');

    const closeSaveAsModal = () => {
      saveAsModal.classList.remove('open');
    };

    document.getElementById('saveAsBtn').addEventListener('click', () => {
      if (!currentTemplate) return;
      saveAsNameInput.value = `${currentTemplate.sheetName} (Salinan)`;
      saveAsIncludePhotos.checked = true;
      saveAsModal.classList.add('open');
      setTimeout(() => saveAsNameInput.focus(), 100);
    });

    document.getElementById('saveAsModalClose').addEventListener('click', closeSaveAsModal);
    document.getElementById('saveAsModalCancel').addEventListener('click', closeSaveAsModal);

    document.getElementById('saveAsModalConfirm').addEventListener('click', async () => {
      if (!currentTemplate) return;
      const newSheetName = saveAsNameInput.value.trim();
      if (!newSheetName) {
        Toast.show('Nama template tidak boleh kosong', 'warning');
        return;
      }

      closeSaveAsModal();

      try {
        const newTemplateId = Storage.generateId('tpl');
        const newTemplate = JSON.parse(JSON.stringify(currentTemplate));
        newTemplate.templateId = newTemplateId;
        newTemplate.sheetName = newSheetName;
        newTemplate.isCopied = true;
        newTemplate.createdAt = Date.now();
        newTemplate.updatedAt = Date.now();

        await Storage.saveTemplates([newTemplate]);

        // Copy photos if checked
        if (saveAsIncludePhotos.checked) {
          const photoKeys = Object.keys(currentPhotos);
          for (const key of photoKeys) {
            const [rowId, slotStr] = key.split('_');
            const slot = parseInt(slotStr, 10);
            const base64 = currentPhotos[key];
            if (base64) {
              await Storage.savePhoto(newTemplateId, rowId, slot, base64);
            }
          }
        }

        Toast.show(`Template "${newSheetName}" berhasil dibuat!`, 'success');
        
        // Refresh templates module if loaded, and navigate to new template
        if (typeof TemplatesModule !== 'undefined') {
          await TemplatesModule.render();
        }

        // Open newly created template
        window.location.hash = `#editor?id=${newTemplateId}`;
      } catch (err) {
        console.error('Save As error:', err);
        Toast.show('Gagal menyimpan template baru: ' + err.message, 'error');
      }
    });

    // Editable Sheet Title
    const titleEl = document.getElementById('editorTitle');
    titleEl.addEventListener('blur', async (e) => {
      if (!currentTemplate) return;
      const newName = e.target.textContent.trim();
      if (newName && newName !== currentTemplate.sheetName) {
        currentTemplate.sheetName = newName;
        await Storage.saveTemplates([currentTemplate]);
        Toast.show('Nama sheet berhasil diubah', 'success');
      }
    });
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });

    // Lightbox
    document.getElementById('lightbox').addEventListener('click', (e) => {
      if (e.target === e.currentTarget || e.target.id === 'lightboxClose') {
        closeLightbox();
      }
    });

    // Keyboard: close lightbox with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
      }
    });
  }

  /**
   * Load and render a template in the editor
   * @param {string} templateId
   */
  async function load(templateId) {
    document.getElementById('editorTableHead').innerHTML = '';
    document.getElementById('editorTableBody').innerHTML = '<tr><td colspan="100%" style="text-align:center; padding: 2rem; color:var(--text-muted)">Loading editor...</td></tr>';

    try {
      const tpl = await Storage.getTemplate(templateId);
      if (!tpl) {
        Toast.show('Template tidak ditemukan', 'error');
        window.location.hash = '#templates';
        return;
      }

      currentTemplate = tpl;
      currentPhotos = await Storage.getPhotos(templateId);

      // Show editor nav item
      document.getElementById('nav-editor').style.display = '';

      // Set header
      document.getElementById('editorTitle').textContent = tpl.sheetName;
      document.getElementById('editorSubtitle').textContent =
        `${tpl.fileName} • ${tpl.rows.length} aktivitas • ${tpl.kelasColumns.length} kelas`;

      renderTable();
    } catch (err) {
      console.error(err);
      Toast.show('Gagal memuat editor', 'error');
    }
  }

  /**
   * Render the checklist table
   */
  function renderTable() {
    if (!currentTemplate) return;

    const tpl = currentTemplate;
    const thead = document.getElementById('editorTableHead');
    const tbody = document.getElementById('editorTableBody');

    // Build header
    let headHtml = '<tr>';
    headHtml += '<th class="col-no">No</th>';
    headHtml += '<th class="col-pekerjaan">Pekerjaan</th>';
    headHtml += '<th class="col-aktivitas">Aktivitas</th>';
    headHtml += '<th class="col-obyek">Obyek Pekerjaan</th>';
    tpl.kelasColumns.forEach(k => {
      headHtml += `<th class="col-kelas">${_escapeHtml(k)}</th>`;
    });
    headHtml += '<th class="col-foto">Evidence Foto</th>';
    headHtml += '</tr>';
    thead.innerHTML = headHtml;

    // Build body with merged PEKERJAAN cells
    let bodyHtml = '';
    const rows = tpl.rows;

    // Helper: normalize pekerjaan value for comparison
    const normPekerjaan = (val) => (val || '').replace(/\s+/g, ' ').trim().toLowerCase();

    // Group by pekerjaan for merge display
    let i = 0;
    while (i < rows.length) {
      const currentPekerjaan = rows[i].pekerjaan;
      const currentNorm = normPekerjaan(currentPekerjaan);
      let span = 1;
      while (i + span < rows.length && normPekerjaan(rows[i + span].pekerjaan) === currentNorm) {
        span++;
      }

      for (let j = 0; j < span; j++) {
        const row = rows[i + j];
        const globalIdx = i + j;
        // Add group boundary class for visual grouping
        const isGroupStart = j === 0 ? ' group-start' : '';
        const isGroupEnd = j === span - 1 ? ' group-end' : '';
        bodyHtml += `<tr id="row-${row.rowId}" class="group-row${isGroupStart}${isGroupEnd}">`;
        bodyHtml += `<td class="col-no">${globalIdx + 1}</td>`;

        // Merged pekerjaan cell (only on first row of group)
        if (j === 0) {
          bodyHtml += `<td class="col-pekerjaan merged-cell" rowspan="${span}">${_escapeHtml(currentPekerjaan)}</td>`;
        }

        bodyHtml += `<td class="col-aktivitas">${_escapeHtml(row.aktivitas)}</td>`;
        bodyHtml += `<td class="col-obyek">${_escapeHtml(row.obyekPekerjaan)}</td>`;

        row.kelasValues.forEach(v => {
          bodyHtml += `<td class="col-kelas">${_escapeHtml(v)}</td>`;
        });

        // Foto cell
        bodyHtml += `<td class="col-foto">${_renderFotoCell(tpl.templateId, row.rowId)}</td>`;

        bodyHtml += '</tr>';
      }

      i += span;
    }

    tbody.innerHTML = bodyHtml;

    // Attach event listeners to upload zones
    _attachUploadListeners();
  }

  /**
   * Render the foto upload cell for a row
   * @private
   */
  function _renderFotoCell(templateId, rowId) {
    const photos = currentPhotos;
    
    // Collect existing photos for this row
    const rowPhotos = [];
    for (let s = 0; s < 20; s++) {
      const key = `${rowId}_${s}`;
      if (photos[key]) {
        rowPhotos.push({ slot: s, base64: photos[key] });
      }
    }

    let html = '<div class="foto-cell" data-template-id="' + templateId + '" data-row-id="' + rowId + '">';

    // Thumbnail grid
    if (rowPhotos.length > 0) {
      html += '<div class="thumbnail-grid">';
      rowPhotos.forEach(p => {
        html += `
          <div class="thumbnail-item" data-slot="${p.slot}" data-row="${rowId}" draggable="true">
            <img src="${p.base64}" alt="Foto ${p.slot + 1}" loading="lazy" draggable="false" style="pointer-events: none;">
            <span class="thumbnail-badge">${p.slot + 1}</span>
            <button class="thumbnail-delete" data-template-id="${templateId}" data-row-id="${rowId}" data-slot="${p.slot}" title="Hapus foto">×</button>
          </div>
        `;
      });
      html += '</div>';
    }

    // Upload zone (show if < 20 photos)
    if (rowPhotos.length < 20) {
      html += `
        <div class="drop-zone-mini upload-zone" data-template-id="${templateId}" data-row-id="${rowId}">
          <input type="file" accept="image/*" multiple>
          <span><span class="material-symbols-outlined" style="font-size:1rem;vertical-align:-2px">add_a_photo</span> +Foto (${rowPhotos.length}/20)</span>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * Helper to re-render just one foto cell after drag/drop or delete
   * @private
   */
  function _updateFotoCellDOM(rowId) {
    const td = document.querySelector(`tr#row-${rowId} .col-foto`);
    if (td && currentTemplate) {
      td.innerHTML = _renderFotoCell(currentTemplate.templateId, rowId);
      _attachUploadListeners(td);
    }
  }

  /**
   * Attach upload & delete listeners to all foto cells
   * @private
   */
  function _attachUploadListeners(container = document) {
    // Upload zones
    container.querySelectorAll('.upload-zone').forEach(zone => {
      const input = zone.querySelector('input[type="file"]');
      const templateId = zone.dataset.templateId;
      const rowId = zone.dataset.rowId;

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
      });

      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        
        try {
          if (currentDragPhoto) {
            await _executeEmptyZoneDrop(rowId);
            return; // Important: prevent file upload fallback
          }
        } catch (err) { console.error(err); }

        currentDragPhoto = null;

        // Handle external files
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          _handlePhotoUpload(templateId, rowId, files);
        }
      });

      input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          _handlePhotoUpload(templateId, rowId, e.target.files);
          e.target.value = '';
        }
      });
    });

    // Helper: Reorder drop onto thumbnail
    const _executeReorderDrop = async (targetRow, targetSlot) => {
      if (!currentDragPhoto) return;
      const source = currentDragPhoto;
      const sourceRow = source.rowId;
      const sourceSlot = parseInt(source.slot);
      const tSlot = parseInt(targetSlot);

      if (sourceRow === targetRow && sourceSlot === tSlot) {
        currentDragPhoto = null;
        return;
      }

      const gatherArr = (rId) => {
        const arr = [];
        for(let s=0; s<20; s++) {
          if(currentPhotos[`${rId}_${s}`]) arr.push({ slot: s, base64: currentPhotos[`${rId}_${s}`] });
        }
        return arr;
      };

      const sArr = gatherArr(sourceRow);
      const tArr = sourceRow === targetRow ? sArr : gatherArr(targetRow);

      const sourceIdx = sArr.findIndex(x => x.slot === sourceSlot);
      const targetIdx = tArr.findIndex(x => x.slot === tSlot);

      if (sourceIdx !== -1 && targetIdx !== -1) {
        const [moved] = sArr.splice(sourceIdx, 1);
        tArr.splice(targetIdx, 0, moved);

        const reassign = async (rId, arr) => {
          const base64Arr = arr.map(a => a.base64);
          for(let s=0; s<20; s++) {
            const key = `${rId}_${s}`;
            if (s < base64Arr.length) {
              currentPhotos[key] = base64Arr[s];
            } else {
              delete currentPhotos[key];
            }
          }
          await Storage.reassignRowPhotos(currentTemplate.templateId, rId, base64Arr);
        };

        await reassign(sourceRow, sArr);
        if (sourceRow !== targetRow) await reassign(targetRow, tArr);

        _updateFotoCellDOM(sourceRow);
        if (sourceRow !== targetRow) _updateFotoCellDOM(targetRow);
      }
      currentDragPhoto = null;
    };

    // Helper: Drop onto empty zone
    const _executeEmptyZoneDrop = async (targetRow) => {
      if (!currentDragPhoto) return;
      const source = currentDragPhoto;
      const sourceRow = source.rowId;

      const gatherArr = (rId) => {
        const arr = [];
        for(let s=0; s<20; s++) {
          if(currentPhotos[`${rId}_${s}`]) arr.push({ slot: s, base64: currentPhotos[`${rId}_${s}`] });
        }
        return arr;
      };

      const sArr = gatherArr(sourceRow);
      const tArr = sourceRow === targetRow ? sArr : gatherArr(targetRow);

      const sourceIdx = sArr.findIndex(x => x.slot === parseInt(source.slot));
      if (sourceIdx !== -1) {
        const [moved] = sArr.splice(sourceIdx, 1);
        tArr.push(moved);

        const reassign = async (rId, arr) => {
          const base64Arr = arr.map(a => a.base64);
          for(let s=0; s<20; s++) {
            const key = `${rId}_${s}`;
            if (s < base64Arr.length) {
              currentPhotos[key] = base64Arr[s];
            } else {
              delete currentPhotos[key];
            }
          }
          await Storage.reassignRowPhotos(currentTemplate.templateId, rId, base64Arr);
        };

        await reassign(sourceRow, sArr);
        if (sourceRow !== targetRow) await reassign(targetRow, tArr);

        _updateFotoCellDOM(sourceRow);
        if (sourceRow !== targetRow) _updateFotoCellDOM(targetRow);
      }
      currentDragPhoto = null;
    };

    // Clear drag visual states helper
    const _clearDragStyles = () => {
      container.querySelectorAll('.thumbnail-item, .drop-zone, .drop-zone-mini').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = '';
        el.style.border = '';
        el.style.zIndex = '';
        el.classList.remove('dragover');
      });
    };

    // Thumbnail drag & drop (reorder photos - Mouse & Touch)
    container.querySelectorAll('.thumbnail-item').forEach(item => {
      // --- Mouse Drag Events ---
      item.addEventListener('dragstart', (e) => {
        currentDragPhoto = { rowId: item.dataset.row, slot: item.dataset.slot };
        e.dataTransfer.setData('text/plain', 'internal_drag'); // required for firefox
        item.style.opacity = '0.5';
      });
      item.addEventListener('dragend', () => {
        _clearDragStyles();
        currentDragPhoto = null;
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        item.style.transform = 'scale(1.05)';
        item.style.border = '2px solid var(--accent)';
        item.style.zIndex = '10';
      });
      item.addEventListener('dragleave', () => {
        item.style.transform = '';
        item.style.border = '';
        item.style.zIndex = '';
      });
      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        _clearDragStyles();
        
        try {
          if (currentDragPhoto) {
            await _executeReorderDrop(item.dataset.row, item.dataset.slot);
            return;
          }
        } catch (err) { console.error(err); }
        
        currentDragPhoto = null;
      });

      // --- Touch Drag Events (Mobile & Tablet) ---
      let touchActive = false;
      let lastTouchTarget = null;

      item.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchActive = true;
        currentDragPhoto = { rowId: item.dataset.row, slot: item.dataset.slot };
        item.style.opacity = '0.5';
        item.style.transform = 'scale(1.1)';
        item.style.zIndex = '100';
      }, { passive: false });

      item.addEventListener('touchmove', (e) => {
        if (!touchActive || !currentDragPhoto) return;
        if (e.cancelable) e.preventDefault(); // Stop mobile browser page scrolling/sliding!

        const touch = e.touches[0];
        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elem) return;

        const targetThumb = elem.closest('.thumbnail-item');
        const targetZone = elem.closest('.drop-zone');
        const dropElem = targetThumb || targetZone;

        if (lastTouchTarget && lastTouchTarget !== dropElem) {
          lastTouchTarget.style.border = '';
          lastTouchTarget.style.transform = '';
          if (lastTouchTarget.classList.contains('drop-zone')) {
            lastTouchTarget.classList.remove('dragover');
          }
        }

        if (dropElem) {
          lastTouchTarget = dropElem;
          if (dropElem.classList.contains('drop-zone')) {
            dropElem.classList.add('dragover');
          } else {
            dropElem.style.border = '2px solid var(--accent)';
            dropElem.style.transform = 'scale(1.05)';
          }
        } else {
          lastTouchTarget = null;
        }
      }, { passive: false });

      const handleTouchEnd = async (e) => {
        if (!touchActive) return;
        touchActive = false;
        _clearDragStyles();

        if (lastTouchTarget) {
          const targetThumb = lastTouchTarget.closest('.thumbnail-item');
          const targetZone = lastTouchTarget.closest('.drop-zone');

          if (targetThumb) {
            await _executeReorderDrop(targetThumb.dataset.row, targetThumb.dataset.slot);
          } else if (targetZone) {
            await _executeEmptyZoneDrop(targetZone.dataset.rowId);
          }
        }

        lastTouchTarget = null;
        currentDragPhoto = null;
      };

      item.addEventListener('touchend', handleTouchEnd);
      item.addEventListener('touchcancel', handleTouchEnd);
    });

    // Thumbnail clicks (lightbox)
    container.querySelectorAll('.thumbnail-item img').forEach(img => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox(img.src);
      });
    });

    // Delete buttons
    container.querySelectorAll('.thumbnail-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const { templateId, rowId, slot } = btn.dataset;
        _deletePhoto(templateId, rowId, parseInt(slot));
      });
    });
  }

  /**
   * Handle photo upload for a specific row
   * @private
   */
  async function _handlePhotoUpload(templateId, rowId, files) {
    const photos = currentPhotos;

    // Find next available slot
    let nextSlot = 0;
    for (let s = 0; s < 20; s++) {
      if (!photos[`${rowId}_${s}`]) {
        nextSlot = s;
        break;
      }
      if (s === 19) {
        Toast.show('Slot foto untuk baris ini sudah penuh (max 20)', 'warning');
        return;
      }
    }

    // Count currently used slots
    let usedSlots = 0;
    for (let s = 0; s < 20; s++) {
      if (photos[`${rowId}_${s}`]) usedSlots++;
    }

    const maxNew = 20 - usedSlots;
    const filesToProcess = Array.from(files).slice(0, maxNew);

    if (filesToProcess.length === 0) {
      Toast.show('Slot foto sudah penuh (max 20 per baris)', 'warning');
      return;
    }

    Toast.show(`Memproses & Menyimpan ${filesToProcess.length} foto...`, 'info');

    try {
      const results = await ImageUtils.compressImages(filesToProcess);

      let slot = nextSlot;
      for (const result of results) {
        // Find next empty slot
        while (slot < 20 && photos[`${rowId}_${slot}`]) {
          slot++;
        }
        if (slot >= 20) break;

        await Storage.savePhoto(templateId, rowId, slot, result.base64);
        photos[`${rowId}_${slot}`] = result.base64;
        slot++;
      }

      Toast.show(`✅ ${results.length} foto berhasil tersimpan`, 'success');

      // Re-render just the affected row's foto cell
      _refreshFotoCell(templateId, rowId);
    } catch (err) {
      console.error(err);
      Toast.show('Gagal menyimpan foto', 'error');
    }
  }

  /**
   * Delete a photo from memory
   * @private
   */
  async function _deletePhoto(templateId, rowId, slot) {
    try {
      await Storage.deletePhoto(templateId, rowId, slot);
      delete currentPhotos[`${rowId}_${slot}`];
      _refreshFotoCell(templateId, rowId);
      Toast.show('Foto dihapus', 'info');
    } catch (err) {
      console.error(err);
      Toast.show('Gagal menghapus foto', 'error');
    }
  }

  /**
   * Refresh just one foto cell without re-rendering entire table
   * @private
   */
  function _refreshFotoCell(templateId, rowId) {
    const cell = document.querySelector(`.foto-cell[data-row-id="${rowId}"]`);
    if (!cell) {
      // Fallback: re-render entire table
      renderTable();
      return;
    }

    // Replace cell content
    const td = cell.parentElement;
    td.innerHTML = _renderFotoCell(templateId, rowId);

    // Re-attach listeners for this cell only
    const zone = td.querySelector('.upload-zone');
    if (zone) {
      const input = zone.querySelector('input[type="file"]');

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          _handlePhotoUpload(templateId, rowId, e.dataTransfer.files);
        }
      });

      input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          _handlePhotoUpload(templateId, rowId, e.target.files);
          e.target.value = '';
        }
      });
    }

    // Lightbox
    td.querySelectorAll('.thumbnail-item img').forEach(img => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox(img.src);
      });
    });

    // Delete buttons
    td.querySelectorAll('.thumbnail-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const data = btn.dataset;
        _deletePhoto(data.templateId, data.rowId, parseInt(data.slot));
      });
    });
  }



  /**
   * Open lightbox with full-size image
   */
  function openLightbox(src) {
    const overlay = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    img.src = src;
    overlay.classList.add('open');
  }

  /**
   * Close lightbox
   */
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
  }

  /**
   * Get current template reference
   */
  function getCurrentTemplate() {
    return currentTemplate;
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
    load,
    renderTable,
    getCurrentTemplate,
    openLightbox,
    closeLightbox
  };
})();
