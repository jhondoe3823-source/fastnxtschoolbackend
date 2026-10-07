/**
 * Branch routes — mounted at /api/branches.
 *
 *   GET    /api/branches           list all branches for the current school
 *   POST   /api/branches           create a new branch
 *   GET    /api/branches/:id       get a single branch
 *   PATCH  /api/branches/:id       update a branch
 *   DELETE /api/branches/:id       delete a branch (cascade)
 *   PATCH  /api/branches/:id/status activate/deactivate a branch
 */

const express = require('express');
const controller = require('../controllers/branches/branch.controller');
const { validateCreateBranch, validateUpdateBranch, validateUpdateStatus } = require('../validators/branches/branch.validator');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.listBranches);
router.post('/', validateCreateBranch, controller.createBranch);
router.get('/:id', controller.getBranch);
router.patch('/:id', validateUpdateBranch, controller.updateBranch);
router.delete('/:id', controller.deleteBranch);
router.patch('/:id/status', validateUpdateStatus, controller.updateBranchStatus);

module.exports = router;
