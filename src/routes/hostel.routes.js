const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const hostelController = require('../controllers/hostel/hostel.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/rooms', hostelController.listRooms.bind(hostelController));
router.post('/rooms', hostelController.createRoom.bind(hostelController));
router.get('/rooms/:id', hostelController.getRoom.bind(hostelController));
router.patch('/rooms/:id', hostelController.updateRoom.bind(hostelController));
router.delete('/rooms/:id', hostelController.deleteRoom.bind(hostelController));

module.exports = router;
