/**
 * Family service — manage guardian families bidirectionally linked to student records.
 */

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { notFound, badRequest } = require('../../utils/errors');

const trimmed = (val) => String(val ?? '').trim();

/**
 * Serialize a Family DB record for the API response.
 * Includes linked students with detailed class & section information.
 */
function serializeFamily(f, linkedStudents = []) {
  return {
    id: f.id,
    familyCode: f.familyCode,
    guardian: f.guardian,
    phone: f.phone || '',
    email: f.email || '',
    address: f.address || '',
    notes: f.notes || '',
    status: f.status || 'Active',
    branchId: f.branchId || null,
    students: linkedStudents.length,
    studentNames: linkedStudents.map((s) => s.name),
    classList: linkedStudents.map((s) => `${s.cls}-${s.section}`),
    studentDetails: linkedStudents.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      name: s.name,
      cls: s.cls,
      section: s.section,
      classLabel: `${s.cls}-${s.section}`,
    })),
    studentIds: linkedStudents.map((s) => s.id),
    billed: 0,
    paid: 0,
    balance: 0,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

async function fetchLinkedStudents(schoolId, guardianName) {
  if (!guardianName) return [];
  try {
    return await prisma.student.findMany({
      where: {
        schoolId,
        OR: [
          { guardian: { equals: guardianName, mode: 'insensitive' } },
          { father: { equals: guardianName, mode: 'insensitive' } },
        ],
      },
      select: { id: true, studentId: true, name: true, cls: true, section: true },
    });
  } catch (err) {
    logger.warn(`Failed to fetch linked students for guardian ${guardianName}: ${err.message}`);
    return [];
  }
}

async function syncOrphanStudentGuardians(schoolId) {
  try {
    const studentsWithGuardian = await prisma.student.findMany({
      where: {
        schoolId,
        NOT: [{ guardian: null }, { guardian: '' }],
      },
      select: { guardian: true, phone: true, email: true, address: true, branchId: true },
    });

    const existingFamilies = await prisma.family.findMany({
      where: { schoolId },
      select: { guardian: true },
    });
    const existingGuardians = new Set(existingFamilies.map((f) => f.guardian.toLowerCase()));

    for (const st of studentsWithGuardian) {
      const gName = trimmed(st.guardian);
      if (gName && !existingGuardians.has(gName.toLowerCase())) {
        const count = await prisma.family.count({ where: { schoolId } });
        const familyCode = `FAM-${String(count + 1).padStart(3, '0')}`;
        await prisma.family.create({
          data: {
            schoolId,
            branchId: st.branchId || null,
            familyCode,
            guardian: gName,
            phone: trimmed(st.phone) || null,
            email: trimmed(st.email) || null,
            address: trimmed(st.address) || null,
            status: 'Active',
          },
        });
        existingGuardians.add(gName.toLowerCase());
      }
    }
  } catch (err) {
    logger.warn(`Failed to sync orphan student guardians: ${err.message}`);
  }
}

async function listFamilies(schoolId, { q, status, branchId, cls } = {}) {
  // Ensure all student guardians have family entries
  await syncOrphanStudentGuardians(schoolId);

  const where = { schoolId };
  if (branchId && branchId !== 'all') where.branchId = branchId;
  if (status && status !== 'All') where.status = status;

  if (q) {
    const query = trimmed(q).toLowerCase();
    where.OR = [
      { guardian: { contains: query, mode: 'insensitive' } },
      { familyCode: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      { address: { contains: query, mode: 'insensitive' } },
    ];
  }

  const families = await prisma.family.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  let results = await Promise.all(
    families.map(async (f) => {
      const students = await fetchLinkedStudents(schoolId, f.guardian);
      return serializeFamily(f, students);
    })
  );

  // Filter class-wise if class parameter is supplied
  if (cls && cls !== 'All') {
    const targetCls = trimmed(cls).toLowerCase();
    results = results.filter((f) =>
      f.studentDetails.some((s) => {
        const fullClassLabel = `${s.cls}-${s.section}`.toLowerCase();
        return (
          s.cls.toLowerCase() === targetCls ||
          s.section.toLowerCase() === targetCls ||
          fullClassLabel === targetCls ||
          fullClassLabel.includes(targetCls)
        );
      })
    );
  }

  return results;
}

async function getFamily(schoolId, id) {
  const family = await prisma.family.findFirst({
    where: { schoolId, OR: [{ id }, { familyCode: id }] },
  });
  if (!family) throw notFound('Family not found.');
  const students = await fetchLinkedStudents(schoolId, family.guardian);
  return serializeFamily(family, students);
}

async function createFamily(schoolId, input) {
  const guardian = trimmed(input.guardian);
  if (!guardian) throw badRequest('Guardian name is required.');

  const count = await prisma.family.count({ where: { schoolId } });
  const familyCode = trimmed(input.familyCode) || `FAM-${String(count + 1).padStart(3, '0')}`;
  const branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;

  let family = await prisma.family.findFirst({
    where: {
      schoolId,
      guardian: { equals: guardian, mode: 'insensitive' },
    },
  });

  if (!family) {
    family = await prisma.family.create({
      data: {
        schoolId,
        branchId,
        familyCode,
        guardian,
        phone: trimmed(input.phone) || null,
        email: trimmed(input.email) || null,
        address: trimmed(input.address) || null,
        notes: trimmed(input.notes) || null,
        status: trimmed(input.status) || 'Active',
      },
    });
  } else {
    // Update existing family details if provided
    const updateData = {};
    if (input.phone) updateData.phone = trimmed(input.phone);
    if (input.email) updateData.email = trimmed(input.email);
    if (input.address) updateData.address = trimmed(input.address);
    if (Object.keys(updateData).length > 0) {
      family = await prisma.family.update({ where: { id: family.id }, data: updateData });
    }
  }

  // If student IDs or student objects are provided, link/update those students
  if (Array.isArray(input.studentIds) && input.studentIds.length > 0) {
    await prisma.student.updateMany({
      where: { schoolId, id: { in: input.studentIds } },
      data: {
        guardian: family.guardian,
        ...(family.phone ? { phone: family.phone } : {}),
        ...(family.email ? { email: family.email } : {}),
        ...(family.address ? { address: family.address } : {}),
      },
    });
  }

  const students = await fetchLinkedStudents(schoolId, family.guardian);
  return serializeFamily(family, students);
}

async function updateFamily(schoolId, id, input) {
  const existing = await prisma.family.findFirst({
    where: { schoolId, OR: [{ id }, { familyCode: id }] },
  });
  if (!existing) throw notFound('Family not found.');

  const data = {};
  if (input.guardian !== undefined) data.guardian = trimmed(input.guardian);
  if (input.phone !== undefined) data.phone = trimmed(input.phone) || null;
  if (input.email !== undefined) data.email = trimmed(input.email) || null;
  if (input.address !== undefined) data.address = trimmed(input.address) || null;
  if (input.notes !== undefined) data.notes = trimmed(input.notes) || null;
  if (input.status !== undefined) data.status = trimmed(input.status);
  if (input.branchId !== undefined) {
    data.branchId = input.branchId && input.branchId !== 'all' ? input.branchId : null;
  }

  const updated = await prisma.family.update({ where: { id: existing.id }, data });

  // Update guardian name on old/new students if guardian name changed
  if (existing.guardian !== updated.guardian) {
    await prisma.student.updateMany({
      where: { schoolId, guardian: { equals: existing.guardian, mode: 'insensitive' } },
      data: { guardian: updated.guardian },
    });
  }

  // Link any newly selected student IDs
  if (Array.isArray(input.studentIds) && input.studentIds.length > 0) {
    await prisma.student.updateMany({
      where: { schoolId, id: { in: input.studentIds } },
      data: {
        guardian: updated.guardian,
        ...(updated.phone ? { phone: updated.phone } : {}),
        ...(updated.email ? { email: updated.email } : {}),
        ...(updated.address ? { address: updated.address } : {}),
      },
    });
  }

  const students = await fetchLinkedStudents(schoolId, updated.guardian);
  return serializeFamily(updated, students);
}

async function deleteFamily(schoolId, id) {
  const existing = await prisma.family.findFirst({
    where: { schoolId, OR: [{ id }, { familyCode: id }] },
  });
  if (!existing) throw notFound('Family not found.');
  await prisma.family.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}

module.exports = {
  listFamilies,
  getFamily,
  createFamily,
  updateFamily,
  deleteFamily,
};
