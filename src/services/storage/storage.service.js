/**
 * Per-school file storage ledger (Cloudinary uploads).
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Record a successful Cloudinary upload against a school.
 * @returns {Promise<object|null>}
 */
async function recordUpload(schoolId, uploaded, meta = {}) {
  if (!schoolId || !uploaded?.url || !uploaded?.publicId) return null;

  try {
    return await prisma.schoolFile.create({
      data: {
        schoolId,
        uploadedById: meta.uploadedById || null,
        publicId: uploaded.publicId,
        url: uploaded.url,
        folder: uploaded.folder || meta.folder || '',
        resourceType: uploaded.resourceType || 'image',
        format: uploaded.format || null,
        bytes: Number(uploaded.bytes) || 0,
        width: uploaded.width || null,
        height: uploaded.height || null,
        originalName: meta.originalName || null,
        purpose: meta.purpose || 'other',
      },
    });
  } catch (err) {
    logger.warn(`Failed to record school file usage for ${schoolId}: ${err.message}`);
    return null;
  }
}

/** Aggregate storage used by one school. */
async function getSchoolUsage(schoolId) {
  const [agg, byPurpose, recent] = await Promise.all([
    prisma.schoolFile.aggregate({
      where: { schoolId },
      _sum: { bytes: true },
      _count: { _all: true },
    }),
    prisma.schoolFile.groupBy({
      by: ['purpose'],
      where: { schoolId },
      _sum: { bytes: true },
      _count: { _all: true },
      orderBy: { purpose: 'asc' },
    }),
    prisma.schoolFile.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        purpose: true,
        originalName: true,
        url: true,
        publicId: true,
        bytes: true,
        format: true,
        resourceType: true,
        createdAt: true,
      },
    }),
  ]);

  const totalBytes = agg._sum.bytes || 0;
  const totalFiles = agg._count._all || 0;

  return {
    schoolId,
    totalBytes,
    totalFiles,
    totalMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    byPurpose: byPurpose.map((row) => ({
      purpose: row.purpose,
      bytes: row._sum.bytes || 0,
      files: row._count._all || 0,
      mb: Math.round(((row._sum.bytes || 0) / (1024 * 1024)) * 100) / 100,
    })),
    recent,
  };
}

module.exports = {
  recordUpload,
  getSchoolUsage,
};
