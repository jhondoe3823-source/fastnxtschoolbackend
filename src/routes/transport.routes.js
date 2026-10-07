const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const transportController = require('../controllers/transport/transport.controller');

const router = express.Router();

router.use(requireAuth);

// Fleet Vehicles
router.get('/vehicles/select', transportController.listVehiclesForSelect);
router.get('/vehicles', transportController.listVehicles);
router.post('/vehicles', transportController.createVehicle);
router.get('/vehicles/:id', transportController.getVehicle);
router.patch('/vehicles/:id', transportController.updateVehicle);
router.delete('/vehicles/:id', transportController.deleteVehicle);

// Transport Routes
router.get('/routes', transportController.listRoutes);
router.post('/routes', transportController.createRoute);
router.get('/routes/:id', transportController.getRoute);
router.patch('/routes/:id', transportController.updateRoute);
router.delete('/routes/:id', transportController.deleteRoute);

module.exports = router;
