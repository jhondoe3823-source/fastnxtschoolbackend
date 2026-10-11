/**
 * Cloudinary upload / delete helpers + per-school storage ledger.
 */

const { cloudinary, isConfigured, folder: defaultFolder } = require('../../config/cloudinary');
const { badRequest } = require('../../utils/errors');
const logger = require('../../utils/logger');
const storageService = require('../storage/storage.service');

const configured = () => isConfigured();

function assertConfigured() {
  if (!configured()) {
    throw badRequest('File uploads are unavailable. Cloudinary is not configured.');
  }
}

/**
 * Images → `image`. PDF / Word / other files → `raw`.
 * PDFs uploaded as `image` often return 401 "deny or ACL failure" on open.
 */
function resolveResourceType(mimetype, originalName, explicit) {
  if (explicit && explicit !== 'auto') return explicit;
  const mime = String(mimetype || '').toLowerCase();
  const name = String(originalName || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (
    mime === 'application/pdf' ||
    mime.includes('word') ||
    mime.includes('officedocument') ||
    mime === 'application/msword' ||
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|txt|csv)$/i.test(name)
  ) {
    return 'raw';
  }
  if (mime.startsWith('video/')) return 'video';
  return 'auto';
}

/**
 * Upload a Buffer (from multer memoryStorage) to Cloudinary.
 * When `schoolId` is provided, the upload is recorded in school_files.
 *
 * @param {Buffer} buffer
 * @param {{
 *   folder?: string,
 *   publicId?: string,
 *   resourceType?: string,
 *   mimetype?: string,
 *   tags?: string[],
 *   overwrite?: boolean,
 *   schoolId?: string,
 *   uploadedById?: string,
 *   originalName?: string,
 *   purpose?: string,
 * }} [options]
 */
async function uploadBuffer(buffer, options = {}) {
  assertConfigured();
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw badRequest('Upload file is empty.');
  }

  const folder = options.folder || defaultFolder;
  const resourceType = resolveResourceType(options.mimetype, options.originalName, options.resourceType);

  // Keep file extension on raw public_ids so delivery URLs end with .pdf / .docx
  let publicId = options.publicId || undefined;
  if (!publicId && resourceType === 'raw' && options.originalName) {
    const base = String(options.originalName)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const ext = (String(options.originalName).match(/\.([^.]+)$/) || [])[1] || '';
    publicId = `${base || 'file'}_${Date.now()}${ext ? `.${ext}` : ''}`;
  }

  const uploaded = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        overwrite: Boolean(options.overwrite),
        tags: options.tags || undefined,
        type: 'upload',
        access_mode: 'public',
      },
      (err, result) => {
        if (err) {
          logger.error(`Cloudinary upload failed: ${err.message}`);
          return reject(badRequest(err.message || 'Cloudinary upload failed.'));
        }
        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          resourceType: result.resource_type,
          folder: result.folder || folder,
        });
      }
    );
    stream.end(buffer);
  });

  if (options.schoolId) {
    const record = await storageService.recordUpload(options.schoolId, uploaded, {
      uploadedById: options.uploadedById || null,
      originalName: options.originalName || null,
      purpose: options.purpose || 'other',
      folder,
    });
    if (record) uploaded.fileId = record.id;
  }

  return uploaded;
}

/**
 * Delete an asset by public_id.
 */
async function destroy(publicId, resourceType = 'image') {
  assertConfigured();
  if (!publicId) throw badRequest('publicId is required to delete an upload.');
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  return { publicId, result: result.result };
}

/** Parse Cloudinary delivery URL → { resourceType, publicId }. */
function parseDeliveryUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const m = raw.match(/\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+?)(?:\?|$)/i);
  if (!m) return null;
  return {
    resourceType: m[1].toLowerCase(),
    publicId: decodeURIComponent(m[2]),
  };
}

/**
 * Build candidate signed private-download URLs (forces attachment download).
 * Works even when public res.cloudinary.com delivery returns ACL deny.
 */
function buildPrivateDownloadCandidates(publicId, { resourceType = 'raw', filename } = {}) {
  assertConfigured();
  const pid = String(publicId || '').trim();
  if (!pid) throw badRequest('publicId is required to download.');

  const attachment = filename
    ? String(filename).replace(/[^\w.\- ()]+/g, '_').slice(0, 120)
    : true;
  const opts = {
    resource_type: resourceType,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + 10 * 60,
    attachment,
  };

  const urls = [];
  const ext = (pid.match(/\.([a-zA-Z0-9]+)$/) || [])[1];
  if (ext) {
    const withoutExt = pid.replace(/\.[a-zA-Z0-9]+$/, '');
    urls.push(cloudinary.utils.private_download_url(withoutExt, ext, opts));
    urls.push(cloudinary.utils.private_download_url(pid, '', opts));
    urls.push(cloudinary.utils.private_download_url(pid, ext, opts));
  } else {
    urls.push(cloudinary.utils.private_download_url(pid, '', opts));
  }
  return [...new Set(urls.filter(Boolean))];
}

/**
 * Fetch file bytes from Cloudinary via signed private download.
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
async function fetchDownloadBuffer(publicId, options = {}) {
  const candidates = buildPrivateDownloadCandidates(publicId, options);
  let lastStatus = 0;

  for (const signedUrl of candidates) {
    try {
      const res = await fetch(signedUrl);
      lastStatus = res.status;
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) continue;
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      return { buffer, contentType };
    } catch (err) {
      logger.warn(`Cloudinary download attempt failed: ${err.message}`);
    }
  }

  logger.error(`Cloudinary private download failed (last ${lastStatus}) for ${publicId}`);
  throw badRequest('Unable to download this file from storage.');
}

module.exports = {
  isConfigured: configured,
  uploadBuffer,
  destroy,
  parseDeliveryUrl,
  buildPrivateDownloadCandidates,
  fetchDownloadBuffer,
};
