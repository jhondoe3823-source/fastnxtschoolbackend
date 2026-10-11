/**
 * Payroll routes — salary structures, monthly cycles, payslips.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const payrollController = require('../controllers/payroll/payroll.controller');

const router = express.Router();

router.use(requireAuth);

// Teacher / staff — own payslips
router.get('/me', payrollController.listMyPayslips);

// Salary structures
router.get('/structures', payrollController.listStructures);
router.post('/structures', payrollController.upsertStructure);
router.patch('/structures/:id', payrollController.updateStructure);
router.delete('/structures/:id', payrollController.deleteStructure);

// Monthly payroll cycles
router.get('/runs', payrollController.listRuns);
router.post('/runs', payrollController.createRun);
router.get('/runs/:id', payrollController.getRun);
router.post('/runs/:id/generate', payrollController.generatePayslips);
router.post('/runs/:id/approve', payrollController.approveRun);
router.post('/runs/:id/pay', payrollController.payRun);
router.delete('/runs/:id', payrollController.deleteRun);

// Payslips
router.get('/payslips', payrollController.listPayslips);
router.patch('/payslips/:id', payrollController.updatePayslip);

module.exports = router;
