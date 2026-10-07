const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const timetableController = require('../controllers/timetable/timetable.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/slots', timetableController.listSlots.bind(timetableController));
router.post('/slots', timetableController.createSlot.bind(timetableController));
router.get('/slots/:id', timetableController.getSlot.bind(timetableController));
router.patch('/slots/:id', timetableController.updateSlot.bind(timetableController));
router.delete('/slots/:id', timetableController.deleteSlot.bind(timetableController));

module.exports = router;
