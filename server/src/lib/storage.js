import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(here, '../../uploads');

/**
 * Two interchangeable providers behind one upload() call.
 *
 * Cloudinary is used whenever its three env vars are present; otherwise files
 * land on local disk so the feature works without an account. Local disk is
 * fine for development but won't survive a redeploy on an ephemeral host —
 * set the Cloudinary vars before deploying.
 */
export const usingCloudinary = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

if (usingCloudinary) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

export const storageProvider = usingCloudinary ? 'cloudinary' : 'local';

/** Strips directory parts and anything exotic out of a client-supplied name. */
export function safeFileName(name = 'file') {
  return path
    .basename(name)
    .replace(/[^\w.\- ]+/g, '_')
    .slice(0, 120);
}

async function uploadToCloudinary({ buffer, mime, name }) {
  const isImage = mime.startsWith('image/');

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'relay',
        // 'raw' keeps non-images downloadable as-is instead of being transformed
        resource_type: isImage ? 'image' : 'raw',
        use_filename: true,
        unique_filename: true,
        filename_override: name,
      },
      (err, res) => {
        if (!err) return resolve(res);

        /**
         * The SDK collapses any non-JSON failure into "Server returned
         * unexpected status code - NNN", which hides the real reason. Re-throw
         * with the status attached so the client sees something actionable
         * rather than a bare 500.
         */
        const status = err.http_code ?? err.error?.http_code;
        const detail = err.error?.message ?? err.message ?? 'Unknown Cloudinary error';
        console.error('[storage] cloudinary upload failed:', { status, detail, name, mime });

        const wrapped = new Error(
          status === 403
            ? `Cloudinary rejected the upload (403). Check that the account is verified and within quota, and that the API key belongs to cloud "${env.cloudinary.cloudName}". Run: node scripts/diagnose-cloudinary.mjs`
            : `Cloudinary upload failed: ${detail}`
        );
        wrapped.status = 502; // upstream problem, not the caller's fault
        reject(wrapped);
      }
    );
    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    mime,
    size: result.bytes ?? buffer.length,
    name,
    width: result.width,
    height: result.height,
  };
}

async function uploadToDisk({ buffer, mime, name }) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // random prefix so two people uploading "photo.jpg" don't collide
  const key = `${crypto.randomBytes(12).toString('hex')}-${safeFileName(name)}`;
  await fs.writeFile(path.join(UPLOAD_DIR, key), buffer);

  return { url: `/uploads/${key}`, mime, size: buffer.length, name };
}

export function upload(file) {
  return usingCloudinary ? uploadToCloudinary(file) : uploadToDisk(file);
}
