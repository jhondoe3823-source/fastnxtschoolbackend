/**
 * School rules controller
 */

const ApiResponse = require('../../utils/response');
const asyncHandler = require('../../utils/async-handler');
const ruleService = require('../../services/rules/rule.service');

const listRules = asyncHandler(async (req, res) => {
  const rules = await ruleService.listRules(req.auth.schoolId, req.query, req.auth);
  return ApiResponse.ok(res, 'Rules loaded successfully.', { rules });
});

const getRule = asyncHandler(async (req, res) => {
  const rule = await ruleService.getRule(req.auth.schoolId, req.params.id);
  return ApiResponse.ok(res, 'Rule loaded successfully.', { rule });
});

const createRule = asyncHandler(async (req, res) => {
  const rule = await ruleService.createRule(req.auth.schoolId, req.body, {
    ...req.auth,
    name: req.auth.name || req.body.createdBy,
  });
  return ApiResponse.created(res, 'Rule created successfully.', { rule });
});

const updateRule = asyncHandler(async (req, res) => {
  const rule = await ruleService.updateRule(req.auth.schoolId, req.params.id, req.body, req.auth);
  return ApiResponse.ok(res, 'Rule updated successfully.', { rule });
});

const deleteRule = asyncHandler(async (req, res) => {
  await ruleService.deleteRule(req.auth.schoolId, req.params.id, req.auth);
  return ApiResponse.ok(res, 'Rule deleted successfully.', { deleted: true });
});

module.exports = { listRules, getRule, createRule, updateRule, deleteRule };
