/**
 * Utility to compress and resize image files before storing in state or localStorage.
 * Constrains dimensions and JPEG quality so base64 string stays under ~30-60KB.
 */
export function compressImageFile(
  file: File, 
  maxWidth = 600, 
  maxHeight = 600, 
  quality = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        resolve('');
        return;
      }

      // If it's already tiny (e.g. SVG or tiny icon < 40KB), use as is
      if (rawDataUrl.length < 50000) {
        resolve(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width || 800;
        let height = img.height || 600;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } else {
          resolve('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80');
        }
      };

      img.onerror = () => {
        // If Image loading fails (e.g. raw HEIC format unsupported by canvas), fallback to lightweight sample photo
        resolve('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80');
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      resolve('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80');
    };

    reader.readAsDataURL(file);
  });
}
