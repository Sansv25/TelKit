/* ============================================================
   import.js — Excel parsing with SheetJS
   Detects headers, KELAS columns, evidence slots, merged cells
   ============================================================ */

const ImportModule = (() => {
  let parsedSheets = []; // temp storage for preview

  /**
   * Initialize the import page event listeners
   */
  function init() {
    const dropZone = document.getElementById('importDropZone');
    const fileInput = document.getElementById('importFileInput');
    const confirmBtn = document.getElementById('importConfirmBtn');
    const cancelBtn = document.getElementById('importCancelBtn');

    // Drag & drop visual
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
        e.target.value = ''; // reset so same file can be re-selected
      }
    });

    confirmBtn.addEventListener('click', confirmImport);
    cancelBtn.addEventListener('click', cancelImport);
  }

  /**
   * Handle uploaded Excel file
   * @param {File} file
   */
  async function handleFile(file) {
    if (!file.name.match(/\.xlsx?$/i)) {
      Toast.show('File harus berformat .xlsx atau .xls', 'error');
      return;
    }

    Toast.show('Membaca file Excel...', 'info');

    try {
      const data = await readFileAsArrayBuffer(file);
      const workbook = XLSX.read(data, { type: 'array' });

      parsedSheets = [];

      for (let i = 0; i < workbook.SheetNames.length; i++) {
        const sheetName = workbook.SheetNames[i];
        const sheet = workbook.Sheets[sheetName];

        const parsed = parseSheet(sheet, sheetName, file.name, i);
        if (parsed) {
          parsedSheets.push(parsed);
        }
      }

      if (parsedSheets.length === 0) {
        Toast.show('Tidak ada sheet valid ditemukan. Pastikan format header sesuai (PEKERJAAN, AKTIVITAS, OBYEK PEKERJAAN).', 'warning');
        return;
      }

      Toast.show(`${parsedSheets.length} sheet berhasil diparse dari "${file.name}"`, 'success');
      showPreview();
    } catch (err) {
      console.error('Import error:', err);
      Toast.show('Gagal membaca file: ' + err.message, 'error');
    }
  }

  /**
   * Read file as ArrayBuffer
   * @param {File} file
   * @returns {Promise<ArrayBuffer>}
   */
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse a single sheet — detect headers, KELAS columns, data rows
   * @param {Object} sheet - XLSX sheet object
   * @param {string} sheetName
   * @param {string} fileName
   * @param {number} sheetIndex
   * @returns {Object|null} template object or null if invalid
   */
  function parseSheet(sheet, sheetName, fileName, sheetIndex) {
    // Convert sheet to array of arrays
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (aoa.length < 2) return null;

    // Find header row: look for row containing PEKERJAAN, AKTIVITAS, OBYEK PEKERJAAN
    let headerRowIdx = -1;
    let colMap = {};

    for (let r = 0; r < Math.min(aoa.length, 10); r++) {
      const row = aoa[r].map(cell => String(cell).toUpperCase().trim());
      
      const pekerjaanIdx = row.findIndex(c => c.includes('PEKERJAAN') && !c.includes('OBYEK'));
      const aktivitasIdx = row.findIndex(c => c.includes('AKTIVITAS'));
      const obyekIdx = row.findIndex(c => c.includes('OBYEK'));

      if (pekerjaanIdx !== -1 && aktivitasIdx !== -1) {
        headerRowIdx = r;
        colMap.pekerjaan = pekerjaanIdx;
        colMap.aktivitas = aktivitasIdx;
        colMap.obyek = obyekIdx !== -1 ? obyekIdx : -1;

        // Find KELAS columns
        colMap.kelasColumns = [];
        colMap.kelasLabels = [];
        for (let c = 0; c < row.length; c++) {
          if (row[c].includes('KELAS')) {
            colMap.kelasColumns.push(c);
            colMap.kelasLabels.push(aoa[r][c].toString().trim());
          }
        }

        // Find evidence foto columns (numbered 1, 2, 3... after EVIDENT header)
        // The evidence header might be on this row or the next
        let evidentStartCol = -1;
        for (let c = 0; c < row.length; c++) {
          if (row[c].includes('EVIDENT') || row[c].includes('FOTO')) {
            evidentStartCol = c;
            break;
          }
        }

        // Check next row for numbered sub-columns
        colMap.fotoSlots = 0;
        if (evidentStartCol !== -1 && r + 1 < aoa.length) {
          const subRow = aoa[r + 1];
          for (let c = evidentStartCol; c < subRow.length; c++) {
            const val = String(subRow[c]).trim();
            if (val && !isNaN(parseInt(val))) {
              colMap.fotoSlots++;
            }
          }
        }
        // Also count columns on same row after evident
        if (colMap.fotoSlots === 0 && evidentStartCol !== -1) {
          // Count remaining columns after evident as potential foto slots
          const afterEvident = row.length - evidentStartCol - 1;
          if (afterEvident > 0) colMap.fotoSlots = afterEvident;
        }

        break;
      }
    }

    if (headerRowIdx === -1) {
      console.warn(`Sheet "${sheetName}": header row not found`);
      return null;
    }

    // Determine data start row (skip sub-header rows)
    let dataStartRow = headerRowIdx + 1;
    // If next row looks like sub-headers (contains numbers 1,2,3...), skip it
    if (dataStartRow < aoa.length) {
      const nextRow = aoa[dataStartRow];
      const firstFewVals = nextRow.slice(0, 5).map(v => String(v).trim());
      const hasNumbers = firstFewVals.some(v => /^\d+$/.test(v));
      const hasNoText = firstFewVals.filter(v => v.length > 3).length === 0;
      if (hasNumbers && hasNoText) {
        dataStartRow++;
      }
    }

    // Parse data rows
    const rows = [];
    let lastPekerjaan = '';
    let lastObyek = '';

    for (let r = dataStartRow; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row || row.length === 0) continue;
      
      // Skip empty rows
      const aktivitas = String(row[colMap.aktivitas] != null ? row[colMap.aktivitas] : '').trim();
      if (!aktivitas) {
        // Check if there's any meaningful content in this row
        const hasContent = row.some((cell, idx) => {
          if (idx === colMap.pekerjaan || idx === colMap.obyek) return false;
          return String(cell != null ? cell : '').trim().length > 0;
        });
        if (!hasContent) continue;
        if (!aktivitas) continue; // Skip rows without aktivitas
      }

      // Handle merged PEKERJAAN — Excel merged cells may be undefined/null/empty
      const rawPekerjaan = colMap.pekerjaan < row.length ? row[colMap.pekerjaan] : undefined;
      let pekerjaan = String(rawPekerjaan != null ? rawPekerjaan : '').replace(/\s+/g, ' ').trim();
      if (pekerjaan) {
        lastPekerjaan = pekerjaan;
      } else {
        pekerjaan = lastPekerjaan;
      }

      // Handle merged OBYEK
      let obyek = '';
      if (colMap.obyek !== -1) {
        obyek = String(row[colMap.obyek] || '').trim();
        if (obyek) {
          lastObyek = obyek;
        } else {
          obyek = lastObyek;
        }
      }

      // Collect KELAS values
      const kelasValues = colMap.kelasColumns.map(c =>
        String(row[c] || '').trim()
      );

      rows.push({
        rowId: 'r' + rows.length,
        pekerjaan,
        aktivitas,
        obyekPekerjaan: obyek,
        kelasValues
      });
    }

    if (rows.length === 0) {
      console.warn(`Sheet "${sheetName}": no data rows found`);
      return null;
    }

    // Build template
    return {
      templateId: Storage.generateId(sheetIndex),
      sheetName: sheetName,
      fileName: fileName,
      kelasColumns: colMap.kelasLabels,
      maxFotoSlots: Math.max(colMap.fotoSlots || 0, 20), // minimum 20 slots
      createdAt: new Date().toISOString(),
      rows: rows
    };
  }

  /**
   * Show preview of parsed sheets before saving (Interactive Editor)
   */
  async function showPreview() {
    const previewSection = document.getElementById('importPreview');
    const sheetsContainer = document.getElementById('importPreviewSheets');
    sheetsContainer.innerHTML = '';

    parsedSheets.forEach((template, sheetIndex) => {
      const sheetEl = document.createElement('div');
      sheetEl.className = 'preview-sheet';
      sheetEl.dataset.sheetIndex = sheetIndex;
      
      renderSheetPreview(template, sheetIndex, sheetEl);
      sheetsContainer.appendChild(sheetEl);
    });

    previewSection.style.display = 'block';
  }

  /**
   * Render a single sheet's preview editor
   */
  async function renderSheetPreview(template, sheetIndex, containerEl) {
    const isDuplicate = await Storage.templateExists(template.sheetName, template.fileName);
    const duplicateWarning = isDuplicate ? `<span class="badge badge-warning" style="margin-left:8px;"><span class="material-symbols-outlined" style="font-size:0.75rem">warning</span> Sudah ada</span>` : '';

    let tableHtml = '<div class="preview-table-wrapper"><table class="data-table"><thead><tr>';
    tableHtml += '<th>No</th><th>Pekerjaan</th><th>Aktivitas</th><th>Obyek Pekerjaan</th>';
    template.kelasColumns.forEach((k, colIdx) => {
      tableHtml += `
        <th>
          <div class="th-action">
            <span class="editable-cell" contenteditable="true" data-type="header" data-sheet="${sheetIndex}" data-col="${colIdx}">${_escapeHtml(k)}</span>
            <button class="btn-delete-icon" onclick="ImportModule.deleteColumn(${sheetIndex}, ${colIdx})" title="Hapus kolom ini">
              <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
            </button>
          </div>
        </th>`;
    });
    tableHtml += '<th style="width: 40px; text-align:center;"><span class="material-symbols-outlined" style="color:var(--text-muted)">delete</span></th>';
    tableHtml += '</tr></thead><tbody>';

    template.rows.forEach((row, rowIdx) => {
      tableHtml += `<tr>`;
      tableHtml += `<td style="text-align:center; color:var(--text-muted);">${rowIdx + 1}</td>`;
      tableHtml += `<td><div class="editable-cell" contenteditable="true" data-type="pekerjaan" data-sheet="${sheetIndex}" data-row="${rowIdx}">${_escapeHtml(row.pekerjaan)}</div></td>`;
      tableHtml += `<td><div class="editable-cell" contenteditable="true" data-type="aktivitas" data-sheet="${sheetIndex}" data-row="${rowIdx}">${_escapeHtml(row.aktivitas)}</div></td>`;
      tableHtml += `<td><div class="editable-cell" contenteditable="true" data-type="obyek" data-sheet="${sheetIndex}" data-row="${rowIdx}">${_escapeHtml(row.obyekPekerjaan)}</div></td>`;
      
      row.kelasValues.forEach((v, colIdx) => {
        tableHtml += `<td><div class="editable-cell" contenteditable="true" data-type="kelas" data-sheet="${sheetIndex}" data-row="${rowIdx}" data-col="${colIdx}">${_escapeHtml(v)}</div></td>`;
      });
      
      tableHtml += `
        <td style="text-align:center;">
          <button class="btn-delete-icon" onclick="ImportModule.deleteRow(${sheetIndex}, ${rowIdx})" title="Hapus baris ini">
            <span class="material-symbols-outlined" style="font-size:1.125rem">close</span>
          </button>
        </td>
      `;
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table></div>';

    // Save scroll position if it exists
    let savedScrollTop = 0;
    let savedScrollLeft = 0;
    const oldWrapper = containerEl.querySelector('.preview-table-wrapper');
    if (oldWrapper) {
      savedScrollTop = oldWrapper.scrollTop;
      savedScrollLeft = oldWrapper.scrollLeft;
    }

    containerEl.innerHTML = `
      <div class="header-action-row">
        <h4 style="display:flex; align-items:center; gap: 8px; flex:1;">
          <span class="material-symbols-outlined" style="font-size:1.25rem;color:var(--accent)">table_chart</span> 
          <input type="text" class="sheet-title-input" data-sheet="${sheetIndex}" value="${_escapeHtml(template.sheetName)}">
          ${duplicateWarning}
        </h4>
        <button class="btn btn-danger btn-sm" onclick="ImportModule.deleteSheet(${sheetIndex})">
          <span class="material-symbols-outlined btn-icon-left">delete</span> Hapus Sheet
        </button>
      </div>
      <div class="text-sm text-muted" style="margin-bottom: var(--space-md);">
        ${template.rows.length} baris • ${template.kelasColumns.length} kolom kelas
      </div>
      <div class="preview-sheet-body">
        ${tableHtml}
      </div>
    `;

    // Restore scroll position
    const newWrapper = containerEl.querySelector('.preview-table-wrapper');
    if (newWrapper) {
      newWrapper.scrollTop = savedScrollTop;
      newWrapper.scrollLeft = savedScrollLeft;
    }

    // Attach listeners for editable cells and title
    _attachEditorListeners(containerEl);
  }

  function _attachEditorListeners(containerEl) {
    // Sheet title change
    const titleInput = containerEl.querySelector('.sheet-title-input');
    if (titleInput) {
      titleInput.addEventListener('change', (e) => {
        const sheetIdx = e.target.dataset.sheet;
        parsedSheets[sheetIdx].sheetName = e.target.value.trim();
        // Re-check duplicate status
        renderSheetPreview(parsedSheets[sheetIdx], sheetIdx, containerEl);
      });
    }

    // Editable cells blur (save changes)
    containerEl.querySelectorAll('.editable-cell').forEach(cell => {
      cell.addEventListener('blur', (e) => {
        const type = e.target.dataset.type;
        const sheetIdx = e.target.dataset.sheet;
        const rowIdx = e.target.dataset.row;
        const colIdx = e.target.dataset.col;
        const val = e.target.textContent.trim();

        const sheet = parsedSheets[sheetIdx];

        if (type === 'pekerjaan') sheet.rows[rowIdx].pekerjaan = val;
        else if (type === 'aktivitas') sheet.rows[rowIdx].aktivitas = val;
        else if (type === 'obyek') sheet.rows[rowIdx].obyekPekerjaan = val;
        else if (type === 'kelas') sheet.rows[rowIdx].kelasValues[colIdx] = val;
        else if (type === 'header') sheet.kelasColumns[colIdx] = val;
      });
      // Prevent enter from making new lines, instead blur
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });
    });
  }

  // --- Exposed UI Actions ---

  async function deleteSheet(sheetIndex) {
    parsedSheets[sheetIndex] = null;
    
    // Remove DOM element directly
    const sheetEl = document.querySelector(`.preview-sheet[data-sheet-index="${sheetIndex}"]`);
    if (sheetEl) sheetEl.remove();

    // Check if all sheets are deleted
    const remaining = parsedSheets.filter(s => s !== null);
    if (remaining.length === 0) {
      cancelImport();
    }
  }

  async function deleteRow(sheetIndex, rowIndex) {
    parsedSheets[sheetIndex].rows[rowIndex] = null;
    
    const containerEl = document.querySelector(`.preview-sheet[data-sheet-index="${sheetIndex}"]`);
    if (containerEl) {
      const cell = containerEl.querySelector(`[data-row="${rowIndex}"]`);
      if (cell) {
        const tr = cell.closest('tr');
        if (tr) tr.remove();
      }
    }

    const remainingRows = parsedSheets[sheetIndex].rows.filter(r => r !== null);
    if (remainingRows.length === 0) {
      await deleteSheet(sheetIndex);
    } else if (containerEl) {
      // Update row count text
      const remainingCols = parsedSheets[sheetIndex].kelasColumns.filter(c => c !== null).length;
      const countEl = containerEl.querySelector('.text-sm.text-muted');
      if (countEl) countEl.innerHTML = `${remainingRows.length} baris &bull; ${remainingCols} kolom kelas`;
    }
  }

  async function deleteColumn(sheetIndex, colIndex) {
    const sheet = parsedSheets[sheetIndex];
    sheet.kelasColumns[colIndex] = null;
    sheet.rows.forEach(row => {
      if (row) row.kelasValues[colIndex] = null;
    });

    const containerEl = document.querySelector(`.preview-sheet[data-sheet-index="${sheetIndex}"]`);
    if (containerEl) {
      // Remove TH
      const thCell = containerEl.querySelector(`[data-type="header"][data-col="${colIndex}"]`);
      if (thCell) {
        const th = thCell.closest('th');
        if (th) th.remove();
      }
      // Remove TDs
      const tdCells = containerEl.querySelectorAll(`[data-type="kelas"][data-col="${colIndex}"]`);
      tdCells.forEach(tdCell => {
        const td = tdCell.closest('td');
        if (td) td.remove();
      });

      // Update col count text
      const remainingRows = sheet.rows.filter(r => r !== null).length;
      const remainingCols = sheet.kelasColumns.filter(c => c !== null).length;
      const countEl = containerEl.querySelector('.text-sm.text-muted');
      if (countEl) countEl.innerHTML = `${remainingRows} baris &bull; ${remainingCols} kolom kelas`;
    }
  }

  /**
   * Confirm import — save all parsed sheets to IndexedDB
   */
  async function confirmImport() {
    if (parsedSheets.length === 0) return;

    // Filter out duplicates and deleted
    const toSave = [];
    for (let t of parsedSheets) {
      if (!t) continue; // Skip deleted sheets

      // Clean up deleted rows and columns before saving
      t.rows = t.rows.filter(r => r !== null);
      
      // Clean up columns
      const activeColsIdx = [];
      t.kelasColumns.forEach((col, idx) => {
        if (col !== null) activeColsIdx.push(idx);
      });
      
      t.kelasColumns = activeColsIdx.map(idx => t.kelasColumns[idx]);
      t.rows.forEach(r => {
        r.kelasValues = activeColsIdx.map(idx => r.kelasValues[idx]);
      });

      const exists = await Storage.templateExists(t.sheetName, t.fileName);
      if (!exists) toSave.push(t);
    }

    const skipped = parsedSheets.length - toSave.length;

    if (toSave.length > 0) {
      try {
        await Storage.saveTemplates(toSave);
        Toast.show(`✅ ${toSave.length} template berhasil disimpan!${skipped > 0 ? ` (${skipped} duplikat dilewati)` : ''}`, 'success');
      } catch (err) {
        Toast.show('Gagal menyimpan template', 'error');
        return;
      }
    } else {
      Toast.show('Semua sheet sudah ada di template. Tidak ada yang disimpan.', 'warning');
    }

    cancelImport(); // Reset UI
    
    // Navigate to templates page
    window.location.hash = '#templates';
  }

  /**
   * Cancel import — hide preview, reset state
   */
  function cancelImport() {
    parsedSheets = [];
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importPreviewSheets').innerHTML = '';
  }

  /**
   * Escape HTML special characters
   * @private
   */
  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { 
    init,
    deleteSheet,
    deleteRow,
    deleteColumn
  };
})();
