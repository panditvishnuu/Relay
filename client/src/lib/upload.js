import { api } from './api';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** "1.4 MB" */
export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export const isImage = (mime = '') => mime.startsWith('image/');

/**
 * Reads an image's natural size before upload so the bubble can reserve the
 * right aspect ratio immediately — no layout jump when the image decodes.
 */
export function measureImage(file) {
  return new Promise((resolve) => {
    if (!isImage(file.type)) return resolve({});

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

/** POST /api/upload with progress. Returns { attachment, type }. */
export async function uploadFile(file, { onProgress, signal } = {}) {
  const { width, height } = await measureImage(file);

  const form = new FormData();
  form.append('file', file);
  if (width) form.append('width', String(width));
  if (height) form.append('height', String(height));

  const { data } = await api.post('/upload', form, {
    signal,
    onUploadProgress: (event) => {
      if (!event.total) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });

  return data;
}
