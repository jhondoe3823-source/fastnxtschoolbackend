/**
 * Payroll controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const payrollService = require('../../services/payroll/payroll.service');

const listStructures = asyncHandler(async (req, res) => {
  const structures = await payrollService.listStructures(req.auth.schoolId, req.query, req.auth);
  return ApiResponse.ok(res, 'Salary structures loaded successfully.', { structures });
});

const upsertStructure = asyncHandler(async (req, res) => {
  const structure = await payrollService.upsertStructure(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Salary structure saved successfully.', { structure });
});

const updateStructure = asyncHandler(async (req, res) => {
  const structure = await payrollService.updateStructure(
    req.auth.schoolId,
    req.params.id,
    req.body,
    req.auth
  );
  return ApiResponse.ok(res, 'Salary structure updated successfully.', { structure });
});

const deleteStructure = asyncHandler(async (req, res) => {
  await payrollService.deleteStructure(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Salary structure deleted successfully.', { deleted: true });
});

const listRuns = asyncHandler(async (req, res) => {
  const runs = await payrollService.listRuns(req.auth.schoolId, req.query, req.auth);
  return ApiResponse.ok(res, 'Payroll cycles loaded successfully.', { runs });
});

const getRun = asyncHandler(async (req, res) => {
  const data = await payrollService.getRun(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Payroll cycle loaded successfully.', data);
});

const createRun = asyncHandler(async (req, res) => {
  const run = await payrollService.createRun(req.auth.schoolId, req.body, req.auth);
  return ApiResponse.created(res, 'Payroll cycle created successfully.', { run });
});

const generatePayslips = asyncHandler(async (req, res) => {
  const run = await payrollService.generatePayslips(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Payslips generated successfully.', { run });
});

const approveRun = asyncHandler(async (req, res) => {
  const run = await payrollService.approveRun(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Payroll cycle approved successfully.', { run });
});

const payRun = asyncHandler(async (req, res) => {
  const run = await payrollService.payRun(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Payroll marked as paid successfully.', { run });
});

const deleteRun = asyncHandler(async (req, res) => {
  await payrollService.deleteRun(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Payroll cycle deleted successfully.', { deleted: true });
});

const listPayslips = asyncHandler(async (req, res) => {
  const payslips = await payrollService.listPayslips(req.auth.schoolId, req.query, req.auth);
  return ApiResponse.ok(res, 'Payslips loaded successfully.', { payslips });
});

const updatePayslip = asyncHandler(async (req, res) => {
  const payslip = await payrollService.updatePayslip(
    req.auth.schoolId,
    req.params.id,
    req.body,
    req.auth
  );
  return ApiResponse.ok(res, 'Payslip updated successfully.', { payslip });
});

const listMyPayslips = asyncHandler(async (req, res) => {
  const data = await payrollService.listMyPayslips(req.auth.schoolId, req.auth);
  return ApiResponse.ok(res, 'My salary records loaded successfully.', data);
});

module.exports = {
  listStructures,
  upsertStructure,
  updateStructure,
  deleteStructure,
  listRuns,
  getRun,
  createRun,
  generatePayslips,
  approveRun,
  payRun,
  deleteRun,
  listPayslips,
  updatePayslip,
  listMyPayslips,
};
