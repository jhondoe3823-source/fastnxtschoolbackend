/**
 * Normalize file attachment payloads — Cloudinary URLs only (no base64 in DB).
 */

const { badRequest } = require('./errors');

const trimmed = (value) => String(value ?? '').trim();

/**
 * Accept [{ name, url, type?, size?, publicId? }] — reject data: URLs.
 */
function normalizeCloudAttachments(list, { required = false, label = 'attachment' } = {}) {
  if (!Array.isArray(list)) {
    if (required) throw badRequest(`At least one ${label} is required.`);
    return [];
  }

  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const url = trimmed(item.url);
    if (!url) continue;
    if (url.startsWith('data:')) {
      throw badRequest(
        `Base64 ${label}s are not allowed. Upload the file to Cloudinary first and send the URL.`
      );
    }
    out.push({
      name: trimmed(item.name) || 'file',
      type: trimmed(item.type) || 'application/octet-stream',
      size: Number(item.size) || 0,
      url,
      publicId: trimmed(item.publicId) || undefined,
    });
  }

  if (required && out.length === 0) {
    throw badRequest(`At least one ${label} is required.`);
  }
  return out;
}

module.exports = { normalizeCloudAttachments };
