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

  /**
   * Initialize the IndexedDB connection
   * @returns {Promise<IDBDatabase>}
   */
  function initDB() {
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

    return dbPromise;
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
   * Get all templates
   * @returns {Promise<Array>}
   */
  async function getTemplates() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readonly');
      const store = tx.objectStore(STORE_TEMPLATES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
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
   * Clear all templates and photos
   */
  async function clearAll() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TEMPLATES, STORE_PHOTOS], 'readwrite');
      
      tx.objectStore(STORE_TEMPLATES).clear();
      tx.objectStore(STORE_PHOTOS).clear();

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
