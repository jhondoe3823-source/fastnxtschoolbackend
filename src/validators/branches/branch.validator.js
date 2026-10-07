/**
 * Branch request rules — shared by the branch routes.
 */

const validate = require('../../middleware/validation.middleware');

const createBranchSchema = {
  body: {
    name: { required: true, minLength: 2, maxLength: 120 },
    code: { required: true, minLength: 2, maxLength: 20 },
    address: { maxLength: 300 },
    city: { maxLength: 80 },
    phone: { maxLength: 40 },
    status: { custom: (value) => (['ACTIVE', 'INACTIVE'].includes(value) ? null : 'Status must be ACTIVE or INACTIVE') },
  },
};

const updateBranchSchema = {
  body: {
    name: { minLength: 2, maxLength: 120 },
    code: { minLength: 2, maxLength: 20 },
    address: { maxLength: 300 },
    city: { maxLength: 80 },
    phone: { maxLength: 40 },
    status: { custom: (value) => (['ACTIVE', 'INACTIVE'].includes(value) ? null : 'Status must be ACTIVE or INACTIVE') },
    isMain: { custom: (value) => (typeof value === 'boolean' ? null : 'isMain must be true or false') },
  },
};

const updateStatusSchema = {
  body: {
    status: { required: true, custom: (value) => (['ACTIVE', 'INACTIVE'].includes(value) ? null : 'Status must be ACTIVE or INACTIVE') },
  },
};

module.exports = {
  validateCreateBranch: validate(createBranchSchema, { message: 'Please check the branch form and try again' }),
  validateUpdateBranch: validate(updateBranchSchema, { message: 'Please check the branch form and try again' }),
  validateUpdateStatus: validate(updateStatusSchema, { message: 'Please provide a valid status' }),
  createBranchSchema,
  updateBranchSchema,
  updateStatusSchema,
};
