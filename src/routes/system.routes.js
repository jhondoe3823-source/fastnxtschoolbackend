/**
 * System routes — health/readiness probes. Mounted at the root of /api, so the
 * endpoint is GET /api/health.
 */

const express = require('express');
const ApiResponse = require('../utils/response');
const asyncHandler = require('../utils/async-handler');
const { prisma } = require('../config/database');
const env = require('../config/env');

const router = express.Router();

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    await prisma.$queryRaw`SELECT 1`;

    return ApiResponse.ok(res, 'Service is healthy.', {
      status: 'ok',
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;
