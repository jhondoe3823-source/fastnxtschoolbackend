/**
 * Cloudinary service.
 *
 * Uploads are not part of the auth/subscription scope. The module reports
 * whether Cloudinary is configured so upload routes can return a clean 503
 * instead of failing deep inside the SDK.
 */

const cloudinaryConfig = require('../../config/cloudinary');

const isConfigured = () => cloudinaryConfig.isConfigured();

/**
 * Placeholder upload — implemented when file uploads are in scope.
 * @throws {Error} always, until wired up.
 */
async function uploadBuffer() {
  if (!isConfigured()) {
    throw new Error('Cloudinary is not configured.');
  }
  throw new Error('Cloudinary uploads are not implemented yet.');
}

module.exports = { isConfigured, uploadBuffer };
