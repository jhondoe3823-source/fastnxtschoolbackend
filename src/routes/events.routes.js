/**
 * Events routes
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const eventController = require('../controllers/events/event.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', eventController.listEvents);
router.post('/', eventController.createEvent);
router.get('/:id', eventController.getEvent);
router.patch('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

module.exports = router;
