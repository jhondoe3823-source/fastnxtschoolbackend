/**
 * School profile request rules — the Institute Profile form.
 *
 * A PATCH is *partial*: the validator only constrains the fields the request
 * actually contains, and the service only writes those. Sending one field can
 * therefore never blank the rest of the profile.
 */

const validate = require('../../middleware/validation.middleware');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const updateProfileSchema = {
  body: {
    // For PATCH (partial update), no field is required - only validate what's sent
    name: { minLength: 2, maxLength: 120 },
    ownerName: { minLength: 2, maxLength: 120 },
    email: {
      maxLength: 160,
      pattern: EMAIL_PATTERN,
      message: 'A valid school email address is required',
    },
    phone: { minLength: 7, maxLength: 40 },
    country: { maxLength: 80 },
    city: { maxLength: 80 },

    // Optional half — an empty string clears the field.
    shortName: { maxLength: 60 },
    address: { maxLength: 300 },
    website: { maxLength: 200 },
    motto: { maxLength: 160 },
    principal: { maxLength: 120 },
    academicSession: { maxLength: 40 },
    instituteNo: { maxLength: 60 },
    logoUrl: { maxLength: 500 },
  },
};

module.exports = {
  validateUpdateProfile: validate(updateProfileSchema, {
    message: 'Please check the institute profile and try again',
  }),
  updateProfileSchema,
};
