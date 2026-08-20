/* ============================================================
   export.js — PDF generation with jsPDF + html2canvas
   Smart layout: auto-detect Portrait/Landscape, priority 1-page packing
   ============================================================ */

const ExportModule = (() => {
  let isExporting = false;
  let activeTemplate = null;
  let activePhotos = null;
  let activeIsPortrait = false;
  let activePhotoSize = 'medium'; // 'small' (70px) | 'medium' (85px) | 'large' (110px)
  let currentPdfDoc = null;
  let currentPdfFilename = '';
  let currentPdfZoom = 1.0; // Zoom level: 0.5 (50%) to 2.5 (250%)

  /**
   * Initialize PDF preview modal listeners - called on app start
   */
  function init() {
    const modal = document.getElementById('pdfPreviewModal');
    if (!modal) return;

    const closeModal = () => modal.classList.remove('open');

    document.getElementById('pdfPreviewModalClose')?.addEventListener('click', closeModal);
    document.getElementById('pdfPreviewCancel')?.addEventListener('click', closeModal);

    // Landscape orientation toggle
    document.getElementById('pdfOrientLandBtn')?.addEventListener('click', async () => {
      if (activeIsPortrait === false) return;
      activeIsPortrait = false;
      _updateOrientationToggleButtons();
      await _generateAndRenderPreview();
    });

    // Portrait orientation toggle
    document.getElementById('pdfOrientPortBtn')?.addEventListener('click', async () => {
      if (activeIsPortrait === true) return;
      activeIsPortrait = true;
      _updateOrientationToggleButtons();
      await _generateAndRenderPreview();
    });

    // Photo size level toggles (5 levels: xxs 35px, xs 50px, small 70px, medium 85px, large 110px)
    const setPhotoSize = async (size) => {
      if (activePhotoSize === size) return;
      activePhotoSize = size;
      _updatePhotoSizeToggleButtons();
      await _generateAndRenderPreview();
    };

    document.getElementById('pdfSizeXxsBtn')?.addEventListener('click', () => setPhotoSize('xxs'));
    document.getElementById('pdfSizeXsBtn')?.addEventListener('click', () => setPhotoSize('xs'));
    document.getElementById('pdfSizeSmallBtn')?.addEventListener('click', () => setPhotoSize('small'));
    document.getElementById('pdfSizeMedBtn')?.addEventListener('click', () => setPhotoSize('medium'));
    document.getElementById('pdfSizeLargeBtn')?.addEventListener('click', () => setPhotoSize('large'));

    // Zoom control buttons (Pojok Kanan Bawah)
    document.getElementById('pdfZoomOutBtn')?.addEventListener('click', () => {
      _setPdfZoom(currentPdfZoom - 0.15);
    });

    document.getElementById('pdfZoomInBtn')?.addEventListener('click', () => {
      _setPdfZoom(currentPdfZoom + 0.15);
    });

    document.getElementById('pdfZoomResetBtn')?.addEventListener('click', () => {
      _setPdfZoom(1.0);
    });

    // Mouse wheel zoom support (Ctrl + wheel or scroll inside modal body)
    const modalBody = document.getElementById('pdfModalBody');
    if (modalBody) {
      modalBody.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          _setPdfZoom(currentPdfZoom + delta);
        }
      }, { passive: false });
    }

    // Download PDF button
    document.getElementById('pdfPreviewDownloadBtn')?.addEventListener('click', () => {
      if (!currentPdfDoc || !currentPdfFilename) {
        Toast.show('File PDF belum siap.', 'warning');
        return;
      }
      currentPdfDoc.save(currentPdfFilename);
      closeModal();
      Toast.show('✅ Dokumen PDF berhasil diunduh!', 'success');
    });
  }

  /**
   * Set PDF Preview Zoom Level
   * @private
   */
  function _setPdfZoom(zoom) {
    currentPdfZoom = Math.min(Math.max(zoom, 0.5), 2.5);
    _applyPdfZoom();
  }

  /**
   * Apply zoom level to preview container DOM
   * @private
   */
  function _applyPdfZoom() {
    const container = document.getElementById('pdfPreviewContainer');
    const valEl = document.getElementById('pdfZoomVal');
    if (valEl) {
      valEl.textContent = `${Math.round(currentPdfZoom * 100)}%`;
    }
    if (container) {
      container.style.setProperty('--pdf-zoom', currentPdfZoom);
    }
  }

  /**
   * Main entry point when user clicks Export PDF
   * Opens PDF Preview modal with live rendered pages
   */
  async function exportPDF(template) {
    if (isExporting) return;
    
    const btn = document.getElementById('exportPdfBtn');
    const originalText = btn ? btn.innerHTML : '';

    try {
      isExporting = true;
      if (btn) {
        btn.innerHTML = '<span class="material-symbols-outlined btn-icon-left spin">refresh</span> Menyiapkan...';
        btn.disabled = true;
      }

      // Fetch photos from IDB
      const photos = await Storage.getPhotos(template.templateId);
      const photoCount = Object.keys(photos).length;

      if (photoCount === 0) {
        Toast.show('Belum ada foto yang diupload. Upload foto terlebih dahulu.', 'warning');
        return;
      }

      activeTemplate = template;
      activePhotos = photos;
      
      // Default orientation: Landscape for multi-column templates, Portrait for single-column few-row templates
      activeIsPortrait = template.kelasColumns.length <= 1 && template.rows.length <= 4;
      activePhotoSize = 'medium'; // default Medium (85px)
      currentPdfZoom = 1.0; // Reset zoom to 100%

      _updateOrientationToggleButtons();
      _updatePhotoSizeToggleButtons();
      _applyPdfZoom();
      await _generateAndRenderPreview();

      // Open PDF Preview Modal
      document.getElementById('pdfPreviewModal').classList.add('open');

    } catch (err) {
      console.error('PDF export preview error:', err);
      _hideProgress();
      Toast.show('Gagal menyiapkan pratinjau PDF: ' + err.message, 'error');
    } finally {
      isExporting = false;
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }
  }

  /**
   * Update Landscape/Portrait toggle button UI states
   * @private
   */
  function _updateOrientationToggleButtons() {
    const landBtn = document.getElementById('pdfOrientLandBtn');
    const portBtn = document.getElementById('pdfOrientPortBtn');

    if (landBtn && portBtn) {
      if (activeIsPortrait) {
        portBtn.classList.add('active', 'btn-primary');
        portBtn.classList.remove('btn-ghost');
        landBtn.classList.remove('active', 'btn-primary');
        landBtn.classList.add('btn-ghost');
      } else {
        landBtn.classList.add('active', 'btn-primary');
        landBtn.classList.remove('btn-ghost');
        portBtn.classList.remove('active', 'btn-primary');
        portBtn.classList.add('btn-ghost');
      }
    }
  }

  /**
   * Update 5-level photo size toggle button UI states
   * @private
   */
  function _updatePhotoSizeToggleButtons() {
    const btnMap = {
      xxs: document.getElementById('pdfSizeXxsBtn'),
      xs: document.getElementById('pdfSizeXsBtn'),
      small: document.getElementById('pdfSizeSmallBtn'),
      medium: document.getElementById('pdfSizeMedBtn'),
      large: document.getElementById('pdfSizeLargeBtn')
    };

    Object.keys(btnMap).forEach(key => {
      const btn = btnMap[key];
      if (btn) {
        if (key === activePhotoSize) {
          btn.classList.add('active', 'btn-primary');
          btn.classList.remove('btn-ghost');
        } else {
          btn.classList.remove('active', 'btn-primary');
          btn.classList.add('btn-ghost');
        }
      }
    });
  }

  /**
   * Generate PDF document and render preview images into modal
   * @private
   */
  async function _generateAndRenderPreview() {
    if (!activeTemplate || !activePhotos) return;

    _showProgress('Menyiapkan pratinjau halaman PDF...');

    const template = activeTemplate;
    const photos = activePhotos;
    const isPortrait = activeIsPortrait;

    // Create hidden container for rendering & measurement
    const container = document.createElement('div');
    container.id = 'pdf-render-container';
    container.style.cssText = `
      position: fixed; 
      left: -9999px; 
      top: 0;
      background: white;
      color: #111;
      font-family: 'Inter', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      padding: 16px;
      box-sizing: border-box;
    `;
    document.body.appendChild(container);

    try {
      // Printable dimensions in mm (margin: 8mm)
      const margin = 8;
      const landW_mm = 297, landH_mm = 210;
      const landPrintW = landW_mm - (margin * 2), landPrintH = landH_mm - (margin * 2); // 281mm x 194mm
      const portW_mm = 210, portH_mm = 297;
      const portPrintW = portW_mm - (margin * 2), portPrintH = portH_mm - (margin * 2); // 194mm x 281mm

      const landContainerW = 1400;
      const portContainerW = 1050;

      const maxLandH_px = Math.floor(landContainerW * (landPrintH / landPrintW)); // ~966px
      const maxPortH_px = Math.floor(portContainerW * (portPrintH / portPrintW)); // ~1520px

      const containerWidth = isPortrait ? portContainerW : landContainerW;
      const maxH_px = isPortrait ? maxPortH_px : maxLandH_px;
      const orientation = isPortrait ? 'portrait' : 'landscape';
      const printableW_mm = isPortrait ? portPrintW : landPrintW;
      const printableH_mm = isPortrait ? portPrintH : landPrintH;

      // 1. Render entire table in container to measure exact rendered heights of every row
      container.style.width = `${containerWidth}px`;
      container.innerHTML = _buildPageTable(template, template.rows, photos, 0, true, isPortrait, activePhotoSize);
      await _waitForImages(container);
      await _sleep(50);

      const rowHeights = [];
      const tbody = container.querySelector('tbody');
      const trList = tbody ? tbody.querySelectorAll('tr') : [];

      if (trList.length === template.rows.length) {
        trList.forEach(tr => rowHeights.push(tr.offsetHeight || 60));
      } else {
        template.rows.forEach(r => {
          let count = 0;
          for (let s = 0; s < 20; s++) {
            if (photos[`${r.rowId}_${s}`]) count++;
          }
          rowHeights.push(count > 0 ? 120 + Math.ceil(count / 6) * 120 : 40);
        });
      }

      const firstPageHeaderH = (container.querySelector('.pdf-header')?.offsetHeight || 50) +
                               (container.querySelector('thead')?.offsetHeight || 35) + 16;
      const subPageHeaderH = (container.querySelector('.pdf-header')?.offsetHeight || 50) +
                              (container.querySelector('thead')?.offsetHeight || 35) + 16;

      // 2. Multi-Page Splitting
      let pages = [];
      let currentPageRows = [];
      let currentH = firstPageHeaderH;

      for (let idx = 0; idx < template.rows.length; idx++) {
        const rH = rowHeights[idx] || 60;

        if (currentPageRows.length > 0 && (currentH + rH > maxH_px)) {
          pages.push(currentPageRows);
          currentPageRows = [template.rows[idx]];
          currentH = subPageHeaderH + rH;
        } else {
          currentPageRows.push(template.rows[idx]);
          currentH += rH;
        }
      }
      if (currentPageRows.length > 0) {
        pages.push(currentPageRows);
      }

      // Initialize jsPDF
      const jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!jsPDFConstructor) {
        throw new Error('Library jsPDF belum termuat. Coba refresh halaman.');
      }
      const pdf = new jsPDFConstructor({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
      });

      const totalPages = pages.length;
      let startRowIndex = 0;
      const pageImages = [];

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        _updateProgress(`Memproses pratinjau halaman ${pageIdx + 1} dari ${totalPages}...`,
          Math.round(((pageIdx + 1) / totalPages) * 90));

        const pageRows = pages[pageIdx];
        const isFirstPage = pageIdx === 0;

        container.style.width = `${containerWidth}px`;
        container.innerHTML = _buildPageTable(template, pageRows, photos, startRowIndex, isFirstPage, isPortrait, activePhotoSize);
        await _waitForImages(container);
        await _sleep(80);

        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: containerWidth
        });

        if (pageIdx > 0) pdf.addPage();

        const imgWidth = printableW_mm;
        let imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight > printableH_mm) {
          imgHeight = printableH_mm;
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);

        // Store data URL for modal preview cards
        pageImages.push(imgData);

        startRowIndex += pageRows.length;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = template.sheetName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      
      currentPdfDoc = pdf;
      currentPdfFilename = `Evidence_${safeName}_${dateStr}.pdf`;

      // Render cards in modal preview container
      const previewContainer = document.getElementById('pdfPreviewContainer');
      if (previewContainer) {
        previewContainer.innerHTML = '';
        pageImages.forEach((imgSrc, idx) => {
          const card = document.createElement('div');
          card.className = 'pdf-page-card';
          card.innerHTML = `
            <img src="${imgSrc}" alt="Pratinjau Halaman ${idx + 1}" loading="lazy">
            <div class="pdf-page-number">Halaman ${idx + 1} dari ${totalPages}</div>
          `;
          previewContainer.appendChild(card);
        });
      }

      const pageCountEl = document.getElementById('pdfPreviewPageCount');
      if (pageCountEl) {
        pageCountEl.textContent = `${totalPages}`;
      }

    } finally {
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      _hideProgress();
    }
  }

  /**
   * Build HTML table for a page chunk
   * @private
   */
  function _buildPageTable(template, rows, photos, startIndex, isFirstPage, isPortrait = false, photoSize = 'medium') {
    const tpl = template;
    let html = '';

    // Title on first page
    if (isFirstPage) {
      html += `
        <div class="pdf-header" style="margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #d32f2f; padding-bottom:6px;">
          <img src="icons/logo-teks.png" style="height:34px; object-fit:contain;" crossorigin="anonymous">
          <h2 style="font-size:15px; margin:0; color:#111; font-weight:700;">
            Evident Housekeeping - ${_esc(tpl.sheetName)}
          </h2>
        </div>
      `;
    }

    html += `
      <table style="width:100%; table-layout:fixed; border-collapse:collapse; border:1px solid #333;">
        <thead>
          <tr style="background:#d32f2f; color:white;">
            <th style="${_thStyle()} width:32px; text-align:center;">No</th>
            <th style="${_thStyle()} width:110px;">PEKERJAAN</th>
            <th style="${_thStyle()} width:130px;">AKTIVITAS</th>
            <th style="${_thStyle()} width:110px;">OBYEK PEKERJAAN</th>
    `;

    tpl.kelasColumns.forEach(k => {
      html += `<th style="${_thStyle()} width:75px;">${_esc(k)}</th>`;
    });

    html += `
            <th style="${_thStyle()} width:auto;">EVIDENT FOTO KOORDINAT & TIMESTAMP</th>
          </tr>
        </thead>
        <tbody>
    `;

    const norm = (val) => (val || '').replace(/\s+/g, ' ').trim().toLowerCase();

    // Pre-check: count total photos across ALL rows on this page
    let totalPhotoCount = 0;
    let singlePhotoBase64 = null;
    for (const r of rows) {
      for (let s = 0; s < 20; s++) {
        if (photos[`${r.rowId}_${s}`]) {
          totalPhotoCount++;
          singlePhotoBase64 = photos[`${r.rowId}_${s}`];
        }
      }
    }
    // If exactly 1 photo total → merge EVIDENT FOTO column with max height limit
    const mergeAllPhotos = totalPhotoCount === 1 && singlePhotoBase64;
    let isFirstRowRendered = false;

    let singleMaxH = '420px';
    if (photoSize === 'xxs') singleMaxH = '160px';
    else if (photoSize === 'xs') singleMaxH = '220px';
    else if (photoSize === 'small') singleMaxH = '300px';
    else if (photoSize === 'large') singleMaxH = '560px';

    let i = 0;
    while (i < rows.length) {
      const currentPekerjaan = rows[i].pekerjaan;
      const normPek = norm(currentPekerjaan);
      
      // Count consecutive rows with same pekerjaan for PEKERJAAN column merge
      let pekSpan = 1;
      while (i + pekSpan < rows.length && norm(rows[i + pekSpan].pekerjaan) === normPek) {
        pekSpan++;
      }

      let pekOffset = 0;
      while (pekOffset < pekSpan) {
        const aktRowIdx = i + pekOffset;
        const currentAktivitas = rows[aktRowIdx].aktivitas;
        const normAkt = norm(currentAktivitas);

        // Count consecutive rows with same aktivitas for AKTIVITAS column merge
        let aktSpan = 1;
        while (
          pekOffset + aktSpan < pekSpan &&
          norm(rows[i + pekOffset + aktSpan].aktivitas) === normAkt
        ) {
          aktSpan++;
        }

        let aktOffset = 0;
        while (aktOffset < aktSpan) {
          const obyekRowIdx = aktRowIdx + aktOffset;
          const currentObyek = rows[obyekRowIdx].obyekPekerjaan;
          const normObyek = norm(currentObyek);

          // Count consecutive rows with same obyek for OBYEK column merge
          let obyekSpan = 1;
          while (
            aktOffset + obyekSpan < aktSpan &&
            norm(rows[aktRowIdx + aktOffset + obyekSpan].obyekPekerjaan) === normObyek
          ) {
            obyekSpan++;
          }

          for (let k = 0; k < obyekSpan; k++) {
            const relIdx = pekOffset + aktOffset + k;
            const globalIdx = startIndex + i + relIdx;
            const row = rows[i + relIdx];
            const bgColor = (i + relIdx) % 2 === 0 ? '#f8f9fa' : '#ffffff';

            html += `<tr>`;
            html += `<td style="${_tdStyle()} text-align:center; color:#666; background:${bgColor};">${globalIdx + 1}</td>`;

            // Merged PEKERJAAN cell (only on first row of group)
            if (pekOffset === 0 && aktOffset === 0 && k === 0) {
              html += `<td style="${_tdStyle()} font-weight:600; background:#edf2f7; vertical-align:middle;" rowspan="${pekSpan}">${_esc(currentPekerjaan)}</td>`;
            }

            // Merged AKTIVITAS cell (only on first row of aktivitas group)
            if (aktOffset === 0 && k === 0) {
              html += `<td style="${_tdStyle()} background:${bgColor}; vertical-align:middle;" ${aktSpan > 1 ? `rowspan="${aktSpan}"` : ''}>${_esc(currentAktivitas)}</td>`;
            }

            // Merged OBYEK cell (only on first row of obyek group)
            if (k === 0) {
              html += `<td style="${_tdStyle()} background:${bgColor}; vertical-align:middle;" ${obyekSpan > 1 ? `rowspan="${obyekSpan}"` : ''}>${_esc(currentObyek)}</td>`;
            }

            // KELAS values
            row.kelasValues.forEach(v => {
              html += `<td style="${_tdStyle()} font-size:9px; color:#555; background:${bgColor};">${_esc(v)}</td>`;
            });

            // EVIDENT FOTO cell
            if (mergeAllPhotos) {
              if (!isFirstRowRendered) {
                isFirstRowRendered = true;
                html += `<td style="${_tdStyle()} padding:6px; vertical-align:middle; text-align:center; background:#ffffff;" rowspan="${rows.length}">`;
                html += `<div style="max-height:${singleMaxH}; max-width:100%; display:inline-block; border:1px solid #cbd5e0; border-radius:4px; overflow:hidden; position:relative;">`;
                html += `<img src="${singlePhotoBase64}" style="max-height:${singleMaxH}; max-width:100%; object-fit:contain; display:block;" crossorigin="anonymous">`;
                html += `</div>`;
                html += `</td>`;
              }
            } else {
              html += `<td style="${_tdStyle()} padding:4px; background:${bgColor};">${_renderPhotoGrid(photos, row.rowId, isPortrait, photoSize)}</td>`;
            }
            html += '</tr>';
          }

          aktOffset += obyekSpan;
        }

        pekOffset += aktSpan;
      }

      i += pekSpan;
    }

    html += '</tbody></table>';
    return html;
  }

  /**
   * Render photo grid for a row in PDF
   * All photos rendered as uniform square thumbnail boxes (no stretching!)
   * @private
   */
  function _renderPhotoGrid(photos, rowId, isPortrait = false, photoSize = 'medium') {
    const rowPhotos = [];
    for (let s = 0; s < 20; s++) {
      const key = `${rowId}_${s}`;
      if (photos[key]) {
        rowPhotos.push({ slot: s, base64: photos[key] });
      }
    }

    if (rowPhotos.length === 0) {
      return '<div style="color:#999; font-style:italic; font-size:9px; text-align:center; padding:4px;">Tidak ada foto</div>';
    }

    let boxSize = '85px';
    if (photoSize === 'xxs') boxSize = '35px';
    else if (photoSize === 'xs') boxSize = '50px';
    else if (photoSize === 'small') boxSize = '70px';
    else if (photoSize === 'large') boxSize = '110px';

    let html = `<div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-start;">`;

    rowPhotos.forEach(p => {
      html += `
        <div style="width:${boxSize}; height:${boxSize}; border:1px solid #cbd5e0; border-radius:3px; overflow:hidden; position:relative; flex-shrink:0;">
          <img src="${p.base64}" style="width:100%; height:100%; object-fit:cover; display:block;" crossorigin="anonymous">
          <div style="position:absolute; bottom:2px; left:2px; background:rgba(0,0,0,0.75); color:white; font-size:9px; padding:1px 5px; border-radius:2px; font-weight:700; box-shadow:0 1px 2px rgba(0,0,0,0.5);">
            ${p.slot + 1}
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  /**
   * Table header cell style
   * @private
   */
  function _thStyle() {
    return 'border:1px solid #2d3748; padding:5px 6px; font-size:9.5px; text-align:left; font-weight:600; word-break:break-word; overflow-wrap:break-word;';
  }

  /**
   * Table data cell style
   * @private
   */
  function _tdStyle() {
    return 'border:1px solid #cbd5e0; padding:4px 6px; font-size:9px; vertical-align:top; word-break:break-word; overflow-wrap:break-word;';
  }

  /**
   * Escape HTML
   * @private
   */
  function _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /**
   * Wait for all images in container to load
   * @private
   */
  function _waitForImages(container) {
    const imgs = container.querySelectorAll('img');
    const promises = Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    return Promise.all(promises);
  }

  /**
   * Sleep helper
   * @private
   */
  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show progress overlay
   * @private
   */
  function _showProgress(text) {
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressBarFill').style.width = '0%';
    document.getElementById('progressOverlay').classList.add('open');
  }

  /**
   * Update progress
   * @private
   */
  function _updateProgress(text, percent) {
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressBarFill').style.width = percent + '%';
  }

  /**
   * Hide progress overlay
   * @private
   */
  function _hideProgress() {
    document.getElementById('progressOverlay').classList.remove('open');
  }

  return { init, exportPDF };
})();
