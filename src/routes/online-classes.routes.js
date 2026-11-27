/**
 * Online Classes + Google Meet integration routes.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const controller = require('../controllers/online-classes/online-class.controller');

const router = express.Router();

// OAuth callback must stay public (Google redirects here with ?code&state).
router.get('/google/callback', controller.googleCallback);

router.use(requireAuth);

router.get('/dashboard', controller.dashboard);
router.get('/google/status', controller.googleStatus);
router.get('/google/connect', controller.googleConnect);
router.delete('/google/disconnect', controller.googleDisconnect);
router.get('/eligible-students', controller.eligibleStudents);
router.post('/sync-due', controller.syncDue);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.post('/:id/cancel', controller.cancel);
router.delete('/:id', controller.remove);
router.post('/:id/join', controller.join);
router.post('/:id/sync-attendance', controller.syncAttendance);
router.get('/:id/sync-logs', controller.syncLogs);
router.patch('/participants/:participantId', controller.correctParticipant);

module.exports = router;
