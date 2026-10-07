const timetableService = require('../../services/timetable/timetable.service');
const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');

class TimetableController {
  listSlots = asyncHandler(async (req, res) => {
    const slots = await timetableService.listSlots(req.auth.schoolId, req.query);
    return ApiResponse.ok(res, 'Timetable slots fetched successfully.', { slots });
  });

  getSlot = asyncHandler(async (req, res) => {
    const slot = await timetableService.getSlotById(req.auth.schoolId, req.params.id);
    return ApiResponse.ok(res, 'Timetable slot fetched.', { slot });
  });

  createSlot = asyncHandler(async (req, res) => {
    const slot = await timetableService.createSlot(req.auth.schoolId, req.body);
    return ApiResponse.created(res, 'Timetable slot created successfully.', { slot });
  });

  updateSlot = asyncHandler(async (req, res) => {
    const slot = await timetableService.updateSlot(req.auth.schoolId, req.params.id, req.body);
    return ApiResponse.ok(res, 'Timetable slot updated successfully.', { slot });
  });

  deleteSlot = asyncHandler(async (req, res) => {
    await timetableService.deleteSlot(req.auth.schoolId, req.params.id);
    return ApiResponse.ok(res, 'Timetable slot deleted successfully.', { deleted: true });
  });
}

module.exports = new TimetableController();
