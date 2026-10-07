/**
 * Auth request rules — shared by the register/login/me routes.
 */

const validate = require('../../middleware/validation.middleware');

/** Pragmatic email shape check — the real proof is an actual delivery. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_MIN = 8;
/** bcrypt silently truncates beyond 72 bytes — reject instead of truncating. */
const PASSWORD_MAX = 72;

const registerSchema = {
  body: {
    schoolName: { required: true, minLength: 2, maxLength: 120 },
    name: { required: true, minLength: 2, maxLength: 120 },
    ownerName: { maxLength: 120 },
    email: {
      required: true,
      maxLength: 160,
      pattern: EMAIL_PATTERN,
      message: 'A valid email address is required',
    },
    phone: { maxLength: 40 },
    country: { maxLength: 80 },
    city: { maxLength: 80 },
    password: {
      required: true,
      minLength: PASSWORD_MIN,
      maxLength: PASSWORD_MAX,
      message: `password must be at least ${PASSWORD_MIN} characters`,
    },
    confirmPassword: {
      maxLength: PASSWORD_MAX,
      custom: (value, body) =>
        value && value !== body.password ? 'passwords do not match' : null,
    },
  },
};

const loginSchema = {
  body: {
    email: {
      required: true,
      maxLength: 160,
      pattern: EMAIL_PATTERN,
      message: 'A valid email address is required',
    },
    password: { required: true, maxLength: PASSWORD_MAX },
    // Optional. `false` shortens the session cookie to "until the browser closes".
    remember: {
      custom: (value) => (typeof value === 'boolean' ? null : 'remember must be true or false'),
    },
  },
};

const updateProfileSchema = {
  body: {
    name: { minLength: 2, maxLength: 120 },
  },
};

module.exports = {
  validateRegister: validate(registerSchema, { message: 'Please check the form and try again' }),
  validateLogin: validate(loginSchema, { message: 'Please provide your email and password' }),
  validateUpdateProfile: validate(updateProfileSchema, { message: 'Please check the form and try again' }),
  registerSchema,
  loginSchema,
  updateProfileSchema,
};
