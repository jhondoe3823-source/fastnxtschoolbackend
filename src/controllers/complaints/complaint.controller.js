/**
 * Complaints / Tickets controller.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const complaintService = require('../../services/complaints/complaint.service');

const listTickets = asyncHandler(async (req, res) => {
  const tickets = await complaintService.listTickets(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Tickets loaded successfully.', { tickets });
});

const getTicket = asyncHandler(async (req, res) => {
  const ticket = await complaintService.getTicket(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Ticket loaded successfully.', { ticket });
});

const createTicket = asyncHandler(async (req, res) => {
  const ticket = await complaintService.createTicket(req.auth.schoolId, req.body, req.authUser?.name);
  return ApiResponse.created(res, 'Ticket created successfully.', { ticket });
});

const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await complaintService.updateTicket(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Ticket updated successfully.', { ticket });
});

const deleteTicket = asyncHandler(async (req, res) => {
  await complaintService.deleteTicket(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Ticket deleted successfully.', { deleted: true });
});

module.exports = {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
};
