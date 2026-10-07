/**
 * Validation rule for routes that take a single `:id` path parameter.
 *
 *   router.get('/:id', validate(idParam), handler)
 */

const validate = require('../../middleware/validation.middleware');

const CUID_PATTERN = /^[a-z0-9]{20,40}$/;

const idParam = validate(
  {
    params: {
      id: { required: true, maxLength: 64 },
    },
  },
  { message: 'A valid id is required' }
);

module.exports = { idParam, CUID_PATTERN };
