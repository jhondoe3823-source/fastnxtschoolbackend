/**
 * File uploads — not implemented yet.
 *
 * Nothing in the auth/subscription scope accepts a file, so rather than pull in
 * multer (and an unused 25mb body parser) this middleware answers 501 with a
 * clear message. When uploads land, wire multer (or busboy) in here and the
 * routes keep the same shape.
 */

const ApiResponse = require('../utils/response');

function upload() {
  return (req, res) =>
    ApiResponse.error(
      res,
      501,
      'File uploads are not enabled yet.',
      null,
      'NOT_IMPLEMENTED'
    );
}

module.exports = { upload };
