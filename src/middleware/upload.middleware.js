/**
 * Multer upload middleware (memory storage → Cloudinary).
 */

const multer = require('multer');
const ApiResponse = require('../utils/response');
const { badRequest } = require('../utils/errors');

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const storage = multer.memoryStorage();

const imageFilter = (_req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(badRequest('Only image uploads are allowed.'));
  }
  cb(null, true);
};

const anyFilter = (_req, file, cb) => {
  const ok =
    file.mimetype?.startsWith('image/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/msword' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (!ok) {
    return cb(badRequest('Unsupported file type.'));
  }
  cb(null, true);
};

const imageUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: imageFilter,
});

const fileUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: anyFilter,
});

/** Express error wrapper for multer failures. */
function handleMulterError(err, _req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.error(res, 400, 'File is too large (max 8 MB).', null, 'VALIDATION_ERROR');
    }
    return ApiResponse.error(res, 400, err.message || 'Upload failed.', null, 'VALIDATION_ERROR');
  }
  if (err.isOperational) {
    return ApiResponse.error(res, err.statusCode || 400, err.message, err.errors, err.code);
  }
  return next(err);
}

module.exports = {
  imageUpload,
  fileUpload,
  handleMulterError,
  singleImage: imageUpload.single('file'),
  singleFile: fileUpload.single('file'),
};
