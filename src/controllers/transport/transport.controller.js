const transportService = require('../../services/transport/transport.service');
const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');

class TransportController {
  // Vehicles
  listVehicles = asyncHandler(async (req, res) => {
    const vehicles = await transportService.listVehicles(req.auth.schoolId, req.query);
    return ApiResponse.ok(res, 'Vehicles fetched successfully.', { vehicles });
  });

  listVehiclesForSelect = asyncHandler(async (req, res) => {
    const vehicles = await transportService.listVehiclesForSelect(req.auth.schoolId, req.query.branchId);
    return ApiResponse.ok(res, 'Vehicles for select fetched.', { vehicles });
  });

  getVehicle = asyncHandler(async (req, res) => {
    const vehicle = await transportService.getVehicleById(req.auth.schoolId, req.params.id);
    return ApiResponse.ok(res, 'Vehicle details fetched.', { vehicle });
  });

  createVehicle = asyncHandler(async (req, res) => {
    const vehicle = await transportService.createVehicle(req.auth.schoolId, req.body);
    return ApiResponse.created(res, 'Vehicle created successfully.', { vehicle });
  });

  updateVehicle = asyncHandler(async (req, res) => {
    const vehicle = await transportService.updateVehicle(req.auth.schoolId, req.params.id, req.body);
    return ApiResponse.ok(res, 'Vehicle updated successfully.', { vehicle });
  });

  deleteVehicle = asyncHandler(async (req, res) => {
    await transportService.deleteVehicle(req.auth.schoolId, req.params.id);
    return ApiResponse.ok(res, 'Vehicle deleted successfully.', { deleted: true });
  });

  // Routes
  listRoutes = asyncHandler(async (req, res) => {
    const routes = await transportService.listRoutes(req.auth.schoolId, req.query);
    return ApiResponse.ok(res, 'Transport routes fetched successfully.', { routes });
  });

  getRoute = asyncHandler(async (req, res) => {
    const route = await transportService.getRouteById(req.auth.schoolId, req.params.id);
    return ApiResponse.ok(res, 'Route details fetched.', { route });
  });

  createRoute = asyncHandler(async (req, res) => {
    const route = await transportService.createRoute(req.auth.schoolId, req.body);
    return ApiResponse.created(res, 'Transport route created successfully.', { route });
  });

  updateRoute = asyncHandler(async (req, res) => {
    const route = await transportService.updateRoute(req.auth.schoolId, req.params.id, req.body);
    return ApiResponse.ok(res, 'Transport route updated successfully.', { route });
  });

  deleteRoute = asyncHandler(async (req, res) => {
    await transportService.deleteRoute(req.auth.schoolId, req.params.id);
    return ApiResponse.ok(res, 'Transport route deleted successfully.', { deleted: true });
  });
}

module.exports = new TransportController();
