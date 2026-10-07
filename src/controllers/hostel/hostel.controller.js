const hostelService = require('../../services/hostel/hostel.service');
const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');

class HostelController {
  listRooms = asyncHandler(async (req, res) => {
    const rooms = await hostelService.listRooms(req.auth.schoolId, req.query);
    return ApiResponse.ok(res, 'Hostel rooms fetched successfully.', { rooms });
  });

  getRoom = asyncHandler(async (req, res) => {
    const room = await hostelService.getRoomById(req.auth.schoolId, req.params.id);
    return ApiResponse.ok(res, 'Hostel room fetched.', { room });
  });

  createRoom = asyncHandler(async (req, res) => {
    const room = await hostelService.createRoom(req.auth.schoolId, req.body);
    return ApiResponse.created(res, 'Hostel room created successfully.', { room });
  });

  updateRoom = asyncHandler(async (req, res) => {
    const room = await hostelService.updateRoom(req.auth.schoolId, req.params.id, req.body);
    return ApiResponse.ok(res, 'Hostel room updated successfully.', { room });
  });

  deleteRoom = asyncHandler(async (req, res) => {
    await hostelService.deleteRoom(req.auth.schoolId, req.params.id);
    return ApiResponse.ok(res, 'Hostel room deleted successfully.', { deleted: true });
  });
}

module.exports = new HostelController();
