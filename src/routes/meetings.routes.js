/**
 * Meetings routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const meetingController = require('../controllers/meetings/meeting.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', meetingController.listMeetings);
router.post('/', meetingController.createMeeting);
router.get('/:id', meetingController.getMeeting);
router.patch('/:id', meetingController.updateMeeting);
router.delete('/:id', meetingController.deleteMeeting);

module.exports = router;
