/**
 * Complaints & Tickets routes — mounted at /api/complaints
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const complaintController = require('../controllers/complaints/complaint.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', complaintController.listTickets);
router.post('/', complaintController.createTicket);
router.get('/:id', complaintController.getTicket);
router.patch('/:id', complaintController.updateTicket);
router.delete('/:id', complaintController.deleteTicket);

module.exports = router;
