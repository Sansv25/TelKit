/* ============================================================
   storage.js — IndexedDB wrapper for templates and photos
   Persists data across sessions safely, without size limits
   ============================================================ */

const Storage = (() => {
  const DB_NAME = 'EvidenceFotoDB';
  const DB_VERSION = 1;
  const STORE_TEMPLATES = 'templates';
  const STORE_PHOTOS = 'photos';

  let dbPromise = null;

  // Default templates seeded automatically from EvidenceFoto_Backup_2026-08-19.json
  // Ordered explicitly: Kelas 3, Kelas 4, Kelas 5
  const DEFAULT_TEMPLATES = [
    {
      templateId: 'default_kelas_3',
      sheetName: 'Kelas 3',
      fileName: 'Eviden ruang IOC DAN TL TA.xlsx',
      kelasColumns: ['KELAS 3'],
      maxFotoSlots: 20,
      createdAt: '2026-08-19T10:00:00.000Z',
      isDefault: true,
      rows: [
        { rowId: 'r0', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan dinding', obyekPekerjaan: 'Dinding', kelasValues: ['1 x sebulan'] },
        { rowId: 'r1', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan dan perawatan lantai', obyekPekerjaan: 'Lantai', kelasValues: ['2 x seminggu'] },
        { rowId: 'r2', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan dan perawatan lantai', obyekPekerjaan: 'Lantai', kelasValues: ['1 x setiap triwulan'] },
        { rowId: 'r3', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan dan perawatan lantai', obyekPekerjaan: 'Lantai keramik/granit/marmer', kelasValues: ['1 x sebulan'] },
        { rowId: 'r4', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan plafon', obyekPekerjaan: 'Plafon', kelasValues: ['1 x sebulan'] },
        { rowId: 'r5', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Saluran air', kelasValues: ['2 x sebulan'] },
        { rowId: 'r6', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Sampah', kelasValues: ['1 x sehari'] },
        { rowId: 'r7', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Sampah', kelasValues: ['2 x seminggu'] },
        { rowId: 'r8', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Gordyn dan vertical blind', kelasValues: ['1 x sebulan'] },
        { rowId: 'r9', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan meubelair', obyekPekerjaan: 'Kursi, meja, dan lemari, TV, telephone, kulkas', kelasValues: ['1 x sehari'] },
        { rowId: 'r10', pekerjaan: 'Housekeeping', aktivitas: 'Pekerjaan pest and rodent control', obyekPekerjaan: 'Lingkungan di dalam dan luar gedung', kelasValues: ['1 x sebulan'] },
        { rowId: 'r11', pekerjaan: 'Housekeeping', aktivitas: 'Pekerjaan hygiene service', obyekPekerjaan: 'Pengharum ruangan', kelasValues: ['1 x sebulan'] },
        { rowId: 'r12', pekerjaan: 'Housekeeping', aktivitas: 'Pekerjaan hygiene service', obyekPekerjaan: 'Hygiene unit', kelasValues: ['1 x sebulan'] },
        { rowId: 'r13', pekerjaan: 'Housekeeping', aktivitas: 'Toiletries', obyekPekerjaan: 'Sabun Cuci Tangan', kelasValues: [''] },
        { rowId: 'r14', pekerjaan: 'Housekeeping', aktivitas: 'Toiletries', obyekPekerjaan: 'Keset masuk toilet dan keset closet', kelasValues: [''] },
        { rowId: 'r15', pekerjaan: 'Housekeeping', aktivitas: 'Toiletries', obyekPekerjaan: 'Tissue roll', kelasValues: ['3 x sehari'] },
        { rowId: 'r16', pekerjaan: 'Housekeeping', aktivitas: 'Kebersihan toilet', obyekPekerjaan: 'Dinding, kaca, wastafel, closet, pintu, urinoir', kelasValues: ['3 x sehari'] }
      ]
    },
    {
      templateId: 'default_kelas_4',
      sheetName: 'Kelas 4',
      fileName: 'Eviden ruang IOC DAN TL TA.xlsx',
      kelasColumns: ['KELAS 4'],
      maxFotoSlots: 20,
      createdAt: '2026-08-19T10:01:00.000Z',
      isDefault: true,
      rows: [
        { rowId: 'r0', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan dinding', obyekPekerjaan: 'Dinding', kelasValues: ['1 x sebulan'] },
        { rowId: 'r1', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan dan perawatan lantai', obyekPekerjaan: 'Lantai', kelasValues: ['1 x seminggu'] },
        { rowId: 'r2', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan plafon', obyekPekerjaan: 'Plafon', kelasValues: ['1 x 2 bulan'] },
        { rowId: 'r3', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Saluran air', kelasValues: ['1 x sebulan'] },
        { rowId: 'r4', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Sampah', kelasValues: ['1 x sehari'] },
        { rowId: 'r5', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Sampah', kelasValues: ['1 x seminggu'] },
        { rowId: 'r6', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan meubelair', obyekPekerjaan: 'Kursi, meja, dan lemari, TV, telephone, kulkas', kelasValues: ['1 x sehari'] },
        { rowId: 'r7', pekerjaan: 'Housekeeping', aktivitas: 'Pekerjaan pest and rodent control', obyekPekerjaan: 'Lingkungan di dalam dan luar gedung', kelasValues: ['1 x 2 bulan'] }
      ]
    },
    {
      templateId: 'default_kelas_5',
      sheetName: 'Kelas 5',
      fileName: 'Eviden ruang IOC DAN TL TA.xlsx',
      kelasColumns: ['KELAS 5'],
      maxFotoSlots: 20,
      createdAt: '2026-08-19T10:02:00.000Z',
      isDefault: true,
      rows: [
        { rowId: 'r0', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan dinding', obyekPekerjaan: 'Dinding', kelasValues: ['1 x sebulan'] },
        { rowId: 'r1', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan dan perawatan lantai', obyekPekerjaan: 'Lantai', kelasValues: ['1 x seminggu'] },
        { rowId: 'r2', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan plafon', obyekPekerjaan: 'Plafon', kelasValues: ['1 x 3 bulan'] },
        { rowId: 'r3', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Saluran air', kelasValues: ['1 x sebulan'] },
        { rowId: 'r4', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Sampah', kelasValues: ['1 x seminggu'] },
        { rowId: 'r5', pekerjaan: 'Housekeeping', aktivitas: 'Pembersihan indoor bangunan', obyekPekerjaan: 'Sampah', kelasValues: ['1 x seminggu'] }
      ]
    }
  ];

  /**
   * Initialize the IndexedDB connection and seed defaults if empty
   * @returns {Promise<IDBDatabase>}
   */
  async function initDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create templates store
        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
          db.createObjectStore(STORE_TEMPLATES, { keyPath: 'templateId' });
        }
        
        // Create photos store
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          // Key format: `${templateId}_${rowId}_${slot}`
          const photoStore = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
          photoStore.createIndex('templateId', 'templateId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });

    const db = await dbPromise;
    await seedDefaultTemplatesIfEmpty(db);
    return db;
  }

  /**
   * Seed default templates if database has no templates
   * @private
   */
  async function seedDefaultTemplatesIfEmpty(db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
        const store = tx.objectStore(STORE_TEMPLATES);
        const countReq = store.count();

        countReq.onsuccess = () => {
          if (countReq.result === 0) {
            DEFAULT_TEMPLATES.forEach(tpl => store.put(tpl));
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }

  // ===== TEMPLATES =====

  /**
   * Save an array of templates
   * @param {Array} templates
   */
  async function saveTemplates(templates) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
      const store = tx.objectStore(STORE_TEMPLATES);

      templates.forEach(tpl => store.put(tpl));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get all templates (sorted: Kelas 3, Kelas 4, Kelas 5 first, then custom)
   * @returns {Promise<Array>}
   */
  async function getTemplates() {
    const db = await initDB();
    const rawTemplates = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readonly');
      const store = tx.objectStore(STORE_TEMPLATES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (rawTemplates.length === 0) {
      await seedDefaultTemplatesIfEmpty(db);
      return [...DEFAULT_TEMPLATES];
    }

    // Explicit order: Kelas 3 -> 1, Kelas 4 -> 2, Kelas 5 -> 3, then others
    const orderMap = { 'Kelas 3': 1, 'Kelas 4': 2, 'Kelas 5': 3 };
    return rawTemplates.sort((a, b) => {
      const orderA = orderMap[a.sheetName] || (a.isDefault ? 10 : 99);
      const orderB = orderMap[b.sheetName] || (b.isDefault ? 10 : 99);
      if (orderA !== orderB) return orderA - orderB;

      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    });
  }

  /**
   * Get a specific template by ID
   * @param {string} templateId
   * @returns {Promise<Object>}
   */
  async function getTemplate(templateId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readonly');
      const store = tx.objectStore(STORE_TEMPLATES);
      const request = store.get(templateId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a template AND its associated photos
   * @param {string} templateId
   */
  async function deleteTemplate(templateId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES, STORE_PHOTOS], 'readwrite');
      
      // Delete template
      tx.objectStore(STORE_TEMPLATES).delete(templateId);
      
      // Delete photos for this template
      const photoStore = tx.objectStore(STORE_PHOTOS);
      const index = photoStore.index('templateId');
      const request = index.openCursor(IDBKeyRange.only(templateId));
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Check if a template with same sheetName & fileName exists
   */
  async function templateExists(sheetName, fileName) {
    const templates = await getTemplates();
    return templates.some(t => t.sheetName === sheetName && t.fileName === fileName);
  }

  // ===== PHOTOS =====

  /**
   * Save a single photo
   */
  async function savePhoto(templateId, rowId, slot, base64Data) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readwrite');
      const store = tx.objectStore(STORE_PHOTOS);
      
      store.put({
        id: `${templateId}_${rowId}_${slot}`,
        templateId,
        rowId,
        slot,
        data: base64Data
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get all photos for a template
   * @returns {Promise<Object>} Map of key -> base64
   */
  async function getPhotos(templateId) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readonly');
      const store = tx.objectStore(STORE_PHOTOS);
      const index = store.index('templateId');
      const request = index.getAll(IDBKeyRange.only(templateId));

      request.onsuccess = () => {
        const result = request.result || [];
        const photoMap = {};
        result.forEach(p => {
          photoMap[`${p.rowId}_${p.slot}`] = p.data;
        });
        resolve(photoMap);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a single photo
   */
  async function deletePhoto(templateId, rowId, slot) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readwrite');
      const store = tx.objectStore(STORE_PHOTOS);
      store.delete(`${templateId}_${rowId}_${slot}`);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Bulk reassign photos for a single row
   */
  async function reassignRowPhotos(templateId, rowId, base64Arr) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readwrite');
      const store = tx.objectStore(STORE_PHOTOS);
      
      for (let s = 0; s < 20; s++) {
        store.delete(`${templateId}_${rowId}_${s}`);
      }
      
      for (let s = 0; s < base64Arr.length; s++) {
        if (base64Arr[s]) {
          store.put({
            id: `${templateId}_${rowId}_${s}`,
            templateId,
            rowId,
            slot: s,
            data: base64Arr[s]
          });
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Generate unique ID
   */
  function generateId(prefix = 'tpl') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Export all data to JSON string
   */
  async function exportAllData() {
    const db = await initDB();
    const templates = await getTemplates();
    const photos = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, 'readonly');
      const store = tx.objectStore(STORE_PHOTOS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return JSON.stringify({ templates, photos });
  }

  /**
   * Import all data from JSON string
   */
  async function importAllData(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.templates || !data.photos) {
      throw new Error('Format file backup tidak valid.');
    }
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES, STORE_PHOTOS], 'readwrite');
      const tplStore = tx.objectStore(STORE_TEMPLATES);
      const photoStore = tx.objectStore(STORE_PHOTOS);
      
      data.templates.forEach(tpl => tplStore.put(tpl));
      data.photos.forEach(photo => photoStore.put(photo));
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get storage statistics
   * @returns {Promise<{templateCount: number, photoCount: number}>}
   */
  async function getStats() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES, STORE_PHOTOS], 'readonly');
      
      const templatesReq = tx.objectStore(STORE_TEMPLATES).count();
      const photosReq = tx.objectStore(STORE_PHOTOS).count();

      tx.oncomplete = () => {
        resolve({
          templateCount: templatesReq.result,
          photoCount: photosReq.result
        });
      };
      
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Clear all templates and photos, and automatically restore default templates
   */
  async function clearAll() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES, STORE_PHOTOS], 'readwrite');
      
      tx.objectStore(STORE_TEMPLATES).clear();
      tx.objectStore(STORE_PHOTOS).clear();

      // Automatically re-seed default templates
      DEFAULT_TEMPLATES.forEach(tpl => tx.objectStore(STORE_TEMPLATES).put(tpl));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    initDB,
    saveTemplates,
    getTemplates,
    getTemplate,
    deleteTemplate,
    templateExists,
    savePhoto,
    getPhotos,
    deletePhoto,
    reassignRowPhotos,
    generateId,
    getStats,
    clearAll,
    exportAllData,
    importAllData
  };
})();

