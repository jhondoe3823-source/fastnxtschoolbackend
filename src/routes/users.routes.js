/**
 * Users routes — mounted at /api/users
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const userController = require('../controllers/users/user.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.get('/:id', userController.getUser);
router.patch('/:id', userController.updateUser);
router.post('/:id/reset-password', userController.resetPassword);
router.patch('/:id/status', userController.toggleStatus);
router.delete('/:id', userController.deleteUser);

module.exports = router;
