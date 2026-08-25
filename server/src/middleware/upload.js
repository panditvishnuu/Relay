import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';

/**
 * Allowlist, not a blocklist — anything not named here is refused. Keeps
 * scripts and executables out even if the extension is disguised.
 */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// memory storage: the buffer goes straight to the provider, nothing hits disk twice
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) =>
    ALLOWED_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(ApiError.badRequest(`${file.mimetype} files aren’t supported`)),
});

/** Wraps multer so its own errors come back in our JSON envelope. */
export function singleFile(field = 'file') {
  const handler = multerUpload.single(field);

  return (req, res, next) =>
    handler(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mb = Math.round(env.maxUploadBytes / 1024 / 1024);
        return next(ApiError.badRequest(`Files must be smaller than ${mb}MB`));
      }
      next(err);
    });
}
