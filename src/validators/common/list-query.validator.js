/**
 * Validation rule for `?page` / `?pageSize` list queries.
 *
 * The values are additionally clamped in utils/pagination so a hand-crafted
 * request can never pull the whole table, but validating here gives the client
 * a clean 400 for obvious mistakes.
 */

const validate = require('../../middleware/validation.middleware');

const listQuery = validate(
  {
    query: {
      page: {
        custom: (value) =>
          value !== undefined && !/^\d+$/.test(String(value))
            ? 'page must be a positive integer'
            : null,
      },
      pageSize: {
        custom: (value) =>
          value !== undefined && !/^\d+$/.test(String(value))
            ? 'pageSize must be a positive integer'
            : null,
      },
    },
  },
  { message: 'Invalid pagination parameters' }
);

module.exports = { listQuery };
