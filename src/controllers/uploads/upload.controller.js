/**
 * Generic Cloudinary upload endpoints + school storage usage.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const cloudinaryService = require('../../services/cloudinary/cloudinary.service');
const storageService = require('../../services/storage/storage.service');
const { badRequest } = require('../../utils/errors');

const PURPOSES = new Set([
  'logo',
  'homework',
  'exam-paper',
  'employee-photo',
  'employee-doc',
  'student-photo',
  'student-doc',
  'other',
]);

/** POST /api/uploads — multipart field `file`. */
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No file was uploaded. Use form field "file".');

  const schoolId = req.auth?.schoolId;
  if (!schoolId) throw badRequest('School context is required for uploads.');

  const folderHint = String(req.body?.folder || '')
    .trim()
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .slice(0, 120);
  const purposeRaw = String(req.body?.purpose || 'other').trim().toLowerCase();
  const purpose = PURPOSES.has(purposeRaw) ? purposeRaw : 'other';

  const folder = folderHint
    ? `bisonseducore360/schools/${schoolId}/${folderHint}`
    : `bisonseducore360/schools/${schoolId}/${purpose}`;

  const uploaded = await cloudinaryService.uploadBuffer(req.file.buffer, {
    folder,
    mimetype: req.file.mimetype,
    originalName: req.file.originalname,
    tags: [`school:${schoolId}`, purpose],
    schoolId,
    uploadedById: req.auth?.userId || null,
    purpose,
  });

  return ApiResponse.created(res, 'File uploaded successfully.', {
    upload: {
      ...uploaded,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: uploaded.bytes || req.file.size || 0,
      purpose,
    },
  });
});

/** GET /api/uploads/status — whether Cloudinary is ready. */
const status = asyncHandler(async (_req, res) => {
  return ApiResponse.ok(res, 'Upload status.', {
    configured: cloudinaryService.isConfigured(),
  });
});

/** GET /api/uploads/usage — storage used by the signed-in school. */
const usage = asyncHandler(async (req, res) => {
  const data = await storageService.getSchoolUsage(req.auth.schoolId);
  return ApiResponse.ok(res, 'School storage usage loaded.', { usage: data });
});

/**
 * GET /api/uploads/download?publicId=&url=&filename=&resourceType=
 * Streams the file as an attachment (download) via signed Cloudinary API —
 * avoids browser hitting ACL-denied public delivery URLs.
 */
const download = asyncHandler(async (req, res) => {
  let publicId = String(req.query.publicId || '').trim();
  let resourceType = String(req.query.resourceType || '').trim().toLowerCase();
  const filenameHint = String(req.query.filename || '').trim();
  const url = String(req.query.url || '').trim();

  if (!publicId && url) {
    const parsed = cloudinaryService.parseDeliveryUrl(url);
    if (!parsed) throw badRequest('Invalid file URL.');
    publicId = parsed.publicId;
    if (!resourceType) resourceType = parsed.resourceType;
  }
  if (!publicId) throw badRequest('publicId or url is required.');
  if (!resourceType) resourceType = 'raw';

  const fromPublicId = publicId.split('/').pop() || 'document';
  let filename = filenameHint || fromPublicId;
  // Keep original extension so the browser saves a usable file (e.g. .pdf)
  const ext = (fromPublicId.match(/\.([a-zA-Z0-9]+)$/) || [])[1];
  if (ext && !/\.[a-zA-Z0-9]+$/i.test(filename)) {
    filename = `${filename}.${ext}`;
  }

  const { buffer, contentType } = await cloudinaryService.fetchDownloadBuffer(publicId, {
    resourceType,
    filename,
  });

  const safeName = filename.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'document';
  res.setHeader('Content-Type', contentType.includes('json') ? 'application/octet-stream' : contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).send(buffer);
});

module.exports = { uploadFile, status, usage, download };
