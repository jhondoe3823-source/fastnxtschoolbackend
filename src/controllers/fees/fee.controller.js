/**
 * Fees controller — particulars, structure, discounts, invoices.
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const feeService = require('../../services/fees/fee.service');

/* Particulars */
const listParticulars = asyncHandler(async (req, res) => {
  const particulars = await feeService.listParticulars(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Fee particulars loaded.', { particulars });
});
const createParticular = asyncHandler(async (req, res) => {
  const particular = await feeService.createParticular(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Fee particular created.', { particular });
});
const updateParticular = asyncHandler(async (req, res) => {
  const particular = await feeService.updateParticular(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Fee particular updated.', { particular });
});
const deleteParticular = asyncHandler(async (req, res) => {
  const result = await feeService.deleteParticular(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Fee particular deleted.', result);
});

/* Structure */
const listStructure = asyncHandler(async (req, res) => {
  const structure = await feeService.listStructure(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Fee structure loaded.', { structure });
});
const createStructureLine = asyncHandler(async (req, res) => {
  const line = await feeService.createStructureLine(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Fee structure line added.', { line });
});
const copyStructure = asyncHandler(async (req, res) => {
  const structure = await feeService.copyStructure(req.auth.schoolId, req.body);
  return ApiResponse.ok(res, 'Fee structure copied.', { structure });
});
const deleteStructureLine = asyncHandler(async (req, res) => {
  const result = await feeService.deleteStructureLine(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Fee structure line removed.', result);
});

/* Discounts */
const listDiscounts = asyncHandler(async (req, res) => {
  const discounts = await feeService.listDiscounts(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Discount types loaded.', { discounts });
});
const createDiscount = asyncHandler(async (req, res) => {
  const discount = await feeService.createDiscount(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Discount type created.', { discount });
});
const updateDiscount = asyncHandler(async (req, res) => {
  const discount = await feeService.updateDiscount(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Discount type updated.', { discount });
});
const deleteDiscount = asyncHandler(async (req, res) => {
  const result = await feeService.deleteDiscount(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Discount type deleted.', result);
});

/* Invoices */
const listInvoices = asyncHandler(async (req, res) => {
  const invoices = await feeService.listInvoices(req.auth.schoolId, req.query);
  return ApiResponse.ok(res, 'Fee invoices loaded.', { invoices });
});
const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await feeService.createInvoice(req.auth.schoolId, req.body);
  return ApiResponse.created(res, 'Fee invoice created.', { invoice });
});
const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await feeService.updateInvoice(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Fee invoice updated.', { invoice });
});
const recordPayment = asyncHandler(async (req, res) => {
  const invoice = await feeService.recordPayment(req.auth.schoolId, req.params.id, req.body);
  return ApiResponse.ok(res, 'Payment recorded.', { invoice });
});
const deleteInvoice = asyncHandler(async (req, res) => {
  const result = await feeService.deleteInvoice(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Fee invoice deleted.', result);
});

const getVoucherTemplate = asyncHandler(async (req, res) => {
  const data = await feeService.getVoucherTemplate(req.auth.schoolId);
  return ApiResponse.ok(res, 'Fee voucher template loaded.', data);
});

const updateVoucherTemplate = asyncHandler(async (req, res) => {
  const data = await feeService.updateVoucherTemplate(req.auth.schoolId, req.body);
  return ApiResponse.ok(res, 'Fee voucher template saved.', data);
});

module.exports = {
  listParticulars,
  createParticular,
  updateParticular,
  deleteParticular,
  listStructure,
  createStructureLine,
  copyStructure,
  deleteStructureLine,
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  listInvoices,
  createInvoice,
  updateInvoice,
  recordPayment,
  deleteInvoice,
  getVoucherTemplate,
  updateVoucherTemplate,
};
