import { ApiError, asyncHandler } from '../lib/ApiError.js';
import { safeFileName, storageProvider, upload } from '../lib/storage.js';

/**
 * POST /api/upload — returns an attachment descriptor. The client then sends a
 * normal message carrying it, so uploading and sending stay separate: a failed
 * upload never leaves a broken message in the thread.
 */
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file was uploaded');

  const attachment = await upload({
    buffer: req.file.buffer,
    mime: req.file.mimetype,
    name: safeFileName(req.file.originalname),
  });

  // the client measures images before uploading; keep those if the provider
  // didn't report its own. (?? and || can't be mixed unparenthesised.)
  const width = attachment.width ?? (Number(req.body?.width) || undefined);
  const height = attachment.height ?? (Number(req.body?.height) || undefined);

  res.status(201).json({
    attachment: { ...attachment, width, height },
    type: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
    provider: storageProvider,
  });
});
