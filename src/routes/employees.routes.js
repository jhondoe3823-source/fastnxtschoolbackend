/**
 * Employee routes — mounted at /api/employees
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const employeeController = require('../controllers/employees/employee.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', employeeController.listEmployees);
router.post('/', employeeController.createEmployee);
router.get('/:id', employeeController.getEmployee);
router.patch('/:id', employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);
router.post('/:id/documents', employeeController.addEmployeeDocument);

module.exports = router;
