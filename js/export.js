/* ============================================================
   export.js — PDF generation with jsPDF + html2canvas
   Renders table section by section for large datasets
   ============================================================ */

const ExportModule = (() => {
  let isExporting = false;

  /**
   * Export template + photos to PDF
   * @param {Object} template - template object
   */
  async function exportPDF(template) {
    if (isExporting) return;
    
    const btn = document.getElementById('exportPdfBtn');
    const originalText = btn ? btn.innerHTML : '';

    try {
      isExporting = true;
      if (btn) {
        btn.innerHTML = '<span class="material-symbols-outlined btn-icon-left spin">refresh</span> Memproses PDF...';
        btn.disabled = true;
      }

      // 1. Fetch photos from IDB
      const photos = await Storage.getPhotos(template.templateId);

      // Check if there are any photos
      const photoCount = Object.keys(photos).length;
      if (photoCount === 0) {
        Toast.show('Belum ada foto yang diupload. Upload foto terlebih dahulu.', 'warning');
        return;
      }

      // Show progress
      _showProgress('Mempersiapkan data...');

      // Create hidden container for rendering
      const container = document.createElement('div');
      container.id = 'pdf-render-container';
      container.style.cssText = `
        position: fixed; 
        left: -9999px; 
        top: 0;
        width: 1400px;
        background: white;
        color: #111;
        font-family: 'Inter', Arial, sans-serif;
        font-size: 11px;
        line-height: 1.4;
        padding: 20px;
      `;
      document.body.appendChild(container);

      // Build pages — group rows to avoid overly long pages
      const rowsPerPage = 5; // rows per PDF page (adjustable)
      const totalPages = Math.ceil(template.rows.length / rowsPerPage);

      // Get jsPDF constructor — handle different CDN global names
      const jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!jsPDFConstructor) {
        throw new Error('Library jsPDF belum termuat. Coba refresh halaman.');
      }
      const pdf = new jsPDFConstructor({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;

      for (let page = 0; page < totalPages; page++) {
        _updateProgress(`Rendering halaman ${page + 1} dari ${totalPages}...`,
          Math.round(((page) / totalPages) * 90));

        const startRow = page * rowsPerPage;
        const endRow = Math.min(startRow + rowsPerPage, template.rows.length);
        const pageRows = template.rows.slice(startRow, endRow);

        // Build HTML table for this page chunk
        const tableHtml = _buildPageTable(template, pageRows, photos, startRow, page === 0);
        container.innerHTML = tableHtml;

        // Wait a tick for images to load
        await _waitForImages(container);
        await _sleep(100);

        // Render to canvas
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 1400
        });

        // Add to PDF
        if (page > 0) pdf.addPage();

        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // If rendered content is taller than page, scale down
        let finalWidth = imgWidth;
        let finalHeight = imgHeight;
        if (imgHeight > pageHeight - (margin * 2)) {
          finalHeight = pageHeight - (margin * 2);
          finalWidth = (canvas.width * finalHeight) / canvas.height;
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(imgData, 'JPEG', margin, margin, finalWidth, finalHeight);
      }

      // Clean up
      document.body.removeChild(container);

      // Generate filename
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = template.sheetName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      const filename = `Evidence_${safeName}_${dateStr}.pdf`;

      _updateProgress('Menyimpan file PDF...', 95);
      pdf.save(filename);

      _hideProgress();
      Toast.show(`✅ PDF berhasil di-export: ${filename}`, 'success');

    } catch (err) {
      console.error('PDF export error:', err);
      _hideProgress();
      Toast.show('Gagal membuat PDF: ' + err.message, 'error');
    } finally {
      isExporting = false;
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }
  }

  /**
   * Build HTML table for a page chunk
   * @private
   */
  function _buildPageTable(template, rows, photos, startIndex, isFirstPage) {
    const tpl = template;

    let html = '';

    // Title on first page
    if (isFirstPage) {
      html += `
        <div style="margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; padding-bottom:6px;">
          <img src="icons/logo-teks.png" style="height:38px; object-fit:contain;" crossorigin="anonymous">
          <h2 style="font-size:16px; margin:0; color:#111; font-weight:700;">
            Evident Housekeeping - AREA BALI
          </h2>
        </div>
      `;
    }

    html += `
      <table style="width:100%; border-collapse:collapse; border:1px solid #333;">
        <thead>
          <tr style="background:#d32f2f; color:white;">
            <th style="${_thStyle()} width:30px;">No</th>
            <th style="${_thStyle()} min-width:100px;">PEKERJAAN</th>
            <th style="${_thStyle()} min-width:140px;">AKTIVITAS</th>
            <th style="${_thStyle()} min-width:100px;">OBYEK PEKERJAAN</th>
    `;

    tpl.kelasColumns.forEach(k => {
      html += `<th style="${_thStyle()} min-width:70px;">${_esc(k)}</th>`;
    });

    html += `
            <th style="${_thStyle()} min-width:300px;">EVIDENT FOTO KOORDINAT & TIMESTAMP</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Group consecutive rows with same pekerjaan for merge
    const normPekerjaan = (val) => (val || '').replace(/\s+/g, ' ').trim().toLowerCase();
    let i = 0;
    while (i < rows.length) {
      const currentPekerjaan = rows[i].pekerjaan;
      const currentNorm = normPekerjaan(currentPekerjaan);
      let span = 1;
      while (i + span < rows.length && normPekerjaan(rows[i + span].pekerjaan) === currentNorm) {
        span++;
      }

      // Calculate photo counts to determine if we should auto-merge photos
      for (let j = 0; j < span; j++) {
        let pCount = 0;
        for (let s = 0; s < 20; s++) {
          if (photos[`${rows[i + j].rowId}_${s}`]) pCount++;
        }
        rows[i + j]._photoCount = pCount;
      }

      let shouldMergePhotos = false;
      if (span > 1 && rows[i]._photoCount > 0) {
        let othersEmpty = true;
        for (let j = 1; j < span; j++) {
          if (rows[i + j]._photoCount > 0) {
            othersEmpty = false;
            break;
          }
        }
        if (othersEmpty) shouldMergePhotos = true;
      }

      for (let j = 0; j < span; j++) {
        const row = rows[i + j];
        const globalIdx = startIndex + i + j;
        const bgColor = (i + j) % 2 === 0 ? '#f8f9fa' : '#ffffff';

        html += `<tr>`;
        html += `<td style="${_tdStyle()} text-align:center; color:#666; background:${bgColor};">${globalIdx + 1}</td>`;

        // Merged pekerjaan
        if (j === 0) {
          html += `<td style="${_tdStyle()} font-weight:600; background:#edf2f7; vertical-align:middle;" rowspan="${span}">${_esc(currentPekerjaan)}</td>`;
        }

        html += `<td style="${_tdStyle()} background:${bgColor};">${_esc(row.aktivitas)}</td>`;
        html += `<td style="${_tdStyle()} background:${bgColor};">${_esc(row.obyekPekerjaan)}</td>`;

        row.kelasValues.forEach(v => {
          html += `<td style="${_tdStyle()} font-size:9px; color:#555; background:${bgColor};">${_esc(v)}</td>`;
        });

        // Photo grid with auto-merge logic
        if (shouldMergePhotos) {
          if (j === 0) {
            html += `<td style="${_tdStyle()} padding:4px; vertical-align:top; background:#ffffff;" rowspan="${span}">${_renderPhotoGrid(photos, row.rowId, true)}</td>`;
          }
        } else {
          html += `<td style="${_tdStyle()} padding:4px; background:${bgColor};">${_renderPhotoGrid(photos, row.rowId, false)}</td>`;
        }
        html += '</tr>';
      }

      i += span;
    }

    html += '</tbody></table>';
    return html;
  }

  /**
   * Render photo grid for a row in PDF
   * @private
   */
  function _renderPhotoGrid(photos, rowId, isMerged = false) {
    const rowPhotos = [];
    for (let s = 0; s < 20; s++) {
      const key = `${rowId}_${s}`;
      if (photos[key]) {
        rowPhotos.push({ slot: s, base64: photos[key] });
      }
    }

    if (rowPhotos.length === 0) {
      if (isMerged) return ''; // If merged and somehow 0, render nothing
      return '<div style="color:#999; font-style:italic; text-align:center; padding:8px;">Belum ada foto</div>';
    }

    let html = '<div style="display:flex; flex-wrap:wrap; gap:4px;">';
    rowPhotos.forEach(p => {
      if (isMerged && rowPhotos.length === 1) {
        // Render 1 huge photo
        html += `
          <div style="width:100%; border:1px solid #ccc; border-radius:4px; overflow:hidden; position:relative; background:#fafafa; text-align:center;">
            <img src="${p.base64}" style="width:100%; max-height:450px; object-fit:contain; display:block; margin:0 auto;" crossorigin="anonymous">
            <div style="position:absolute; bottom:2px; left:2px; background:rgba(0,0,0,0.6); color:white; font-size:10px; padding:2px 6px; border-radius:2px;">
              ${p.slot + 1}
            </div>
          </div>
        `;
      } else {
        // Standard grid
        const boxSize = isMerged ? '140px' : '80px';
        html += `
          <div style="width:${boxSize}; height:${boxSize}; border:1px solid #ddd; border-radius:4px; overflow:hidden; position:relative;">
            <img src="${p.base64}" style="width:100%; height:100%; object-fit:cover;" crossorigin="anonymous">
            <div style="position:absolute; bottom:1px; left:1px; background:rgba(0,0,0,0.6); color:white; font-size:8px; padding:1px 4px; border-radius:2px;">
              ${p.slot + 1}
            </div>
          </div>
        `;
      }
    });
    html += '</div>';
    return html;
  }

  /**
   * Table header cell style
   * @private
   */
  function _thStyle() {
    return 'border:1px solid #2d3748; padding:6px 8px; font-size:10px; text-align:left; font-weight:600;';
  }

  /**
   * Table data cell style
   * @private
   */
  function _tdStyle() {
    return 'border:1px solid #cbd5e0; padding:5px 8px; font-size:10px; vertical-align:top;';
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

  return { exportPDF };
})();
