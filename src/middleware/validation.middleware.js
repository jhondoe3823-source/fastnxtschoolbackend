/**
 * Schema-driven request validation.
 *
 *   const validate = require('../../middleware/validation.middleware');
 *   const rules = { body: { email: { required: true, pattern: /.../ } } };
 *   router.post('/', validate(rules), handler);
 *
 * Supported rules per field:
 *   required, minLength, maxLength, pattern (+message), custom(value, body),
 *   equals('otherField'), oneOf([...])
 *
 * All problems are collected and returned together so a form can highlight
 * every invalid field in one round-trip.
 */

const ApiResponse = require('../utils/response');

const isEmpty = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

function validateField(field, value, rules, body) {
  const errors = [];

  if (isEmpty(value)) {
    if (rules.required) errors.push(rules.message || `${field} is required`);
    return errors; // nothing else to check on an empty optional field
  }

  if (rules.minLength && String(value).length < rules.minLength) {
    errors.push(rules.message || `${field} must be at least ${rules.minLength} characters`);
  }

  if (rules.maxLength && String(value).length > rules.maxLength) {
    errors.push(`${field} must not exceed ${rules.maxLength} characters`);
  }

  if (rules.pattern && !rules.pattern.test(String(value))) {
    errors.push(rules.message || `${field} format is invalid`);
  }

  if (rules.oneOf && !rules.oneOf.includes(value)) {
    errors.push(rules.message || `${field} must be one of: ${rules.oneOf.join(', ')}`);
  }

  if (rules.equals && value !== body[rules.equals]) {
    errors.push(rules.message || `${field} must match ${rules.equals}`);
  }

  if (rules.custom) {
    const customError = rules.custom(value, body);
    if (customError) errors.push(customError);
  }

  return errors;
}

function validate(schema, { message = 'Validation failed' } = {}) {
  return (req, res, next) => {
    const errors = [];
    const sources = {
      body: [req.body || {}, schema.body],
      params: [req.params || {}, schema.params],
      query: [req.query || {}, schema.query],
    };

    for (const [, [values, rules]] of Object.entries(sources)) {
      if (!rules) continue;
      for (const [field, fieldRules] of Object.entries(rules)) {
        errors.push(...validateField(field, values[field], fieldRules, values));
      }
    }

    if (errors.length > 0) {
      return ApiResponse.badRequest(res, message, errors);
    }
    return next();
  };
}

module.exports = validate;
module.exports.validate = validate;
