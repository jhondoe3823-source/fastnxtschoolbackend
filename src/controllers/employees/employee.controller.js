/**
 * Employee controller — HTTP layer for managing staff members and documents.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const employeeService = require('../../services/employees/employee.service');

const listEmployees = asyncHandler(async (req, res) => {
  const employees = await employeeService.listEmployees(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Employees loaded successfully.', { employees });
});

const getEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.getEmployee(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Employee loaded successfully.', { employee });
});

const createEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployee(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Employee created successfully.', { employee });
});

const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.updateEmployee(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Employee updated successfully.', { employee });
});

const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Employee deleted successfully.', { deleted: true });
});

const addEmployeeDocument = asyncHandler(async (req, res) => {
  const employee = await employeeService.addEmployeeDocument(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Employee document added successfully.', { employee });
});

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  addEmployeeDocument,
};
