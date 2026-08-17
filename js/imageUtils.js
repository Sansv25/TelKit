/* ============================================================
   imageUtils.js — Client-side image resize & compress
   ============================================================ */

const ImageUtils = (() => {
  /**
   * Compress and resize an image file to JPEG base64
   * @param {File} file - image file from input
   * @param {number} maxWidth - max pixel width (default 1000)
   * @param {number} quality - JPEG quality 0-1 (default 0.70)
   * @returns {Promise<string>} base64 data URL
   */
  function compressImage(file, maxWidth = 1000, quality = 0.70) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('File bukan gambar'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Gagal memuat gambar'));
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;

            // Resize if wider than maxWidth
            if (w > maxWidth) {
              h = Math.round((h * maxWidth) / w);
              w = maxWidth;
            }

            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            const base64 = canvas.toDataURL('image/jpeg', quality);
            resolve(base64);
          } catch (err) {
            reject(err);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compress multiple image files
   * @param {FileList|Array<File>} files
   * @param {number} maxWidth
   * @param {number} quality
   * @returns {Promise<Array<{file: File, base64: string}>>}
   */
  async function compressImages(files, maxWidth = 1000, quality = 0.70) {
    const results = [];
    for (const file of files) {
      try {
        const base64 = await compressImage(file, maxWidth, quality);
        results.push({ file, base64 });
      } catch (err) {
        console.warn('Skipping file:', file.name, err.message);
      }
    }
    return results;
  }

  return {
    compressImage,
    compressImages
  };
})();
