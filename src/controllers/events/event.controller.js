/**
 * Event controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const eventService = require('../../services/events/event.service');

const listEvents = asyncHandler(async (req, res) => {
  const events = await eventService.listEvents(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Events loaded successfully.', { events });
});

const getEvent = asyncHandler(async (req, res) => {
  const event = await eventService.getEvent(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Event loaded successfully.', { event });
});

const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Event created successfully.', { event });
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Event updated successfully.', { event });
});

const deleteEvent = asyncHandler(async (req, res) => {
  await eventService.deleteEvent(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Event deleted successfully.', { deleted: true });
});

module.exports = { listEvents, getEvent, createEvent, updateEvent, deleteEvent };
