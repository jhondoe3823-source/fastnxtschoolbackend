const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

/**
 * Timetable Service — manages Timetable Slots/Periods for School & Branches.
 */
class TimetableService {
  async listSlots(schoolId, filters = {}) {
    const where = { schoolId };

    if (filters.branchId && filters.branchId !== 'all') {
      where.branchId = filters.branchId;
    }
    if (filters.cls || filters.className) {
      where.cls = filters.cls || filters.className;
    }
    if (filters.section) {
      where.section = filters.section;
    }
    if (filters.day) {
      where.day = filters.day;
    }
    if (filters.period) {
      where.period = Number(filters.period);
    }
    if (filters.teacher) {
      where.teacher = { contains: filters.teacher, mode: 'insensitive' };
    }
    if (filters.q) {
      const q = filters.q.trim();
      where.OR = [
        { cls: { contains: q, mode: 'insensitive' } },
        { section: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { teacher: { contains: q, mode: 'insensitive' } },
        { room: { contains: q, mode: 'insensitive' } },
        { day: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.timetableSlot.findMany({
      where,
      orderBy: [
        { day: 'asc' },
        { period: 'asc' },
        { cls: 'asc' },
        { section: 'asc' },
      ],
    });
  }

  async getSlotById(schoolId, id) {
    const slot = await prisma.timetableSlot.findFirst({
      where: { id, schoolId },
    });
    if (!slot) throw notFound('Timetable slot not found.');
    return slot;
  }

  async createSlot(schoolId, data) {
    if (!data.cls || !data.section || !data.day || !data.period || !data.subject || !data.teacher) {
      throw badRequest('Class, section, day, period, subject, and teacher are required.');
    }

    return prisma.timetableSlot.create({
      data: {
        schoolId,
        branchId: data.branchId || null,
        cls: String(data.cls).trim(),
        section: String(data.section).trim(),
        day: String(data.day).trim(),
        period: Number(data.period),
        startTime: data.startTime ? String(data.startTime).trim() : null,
        endTime: data.endTime ? String(data.endTime).trim() : null,
        subject: String(data.subject).trim(),
        teacher: String(data.teacher).trim(),
        teacherId: data.teacherId || null,
        room: data.room ? String(data.room).trim() : null,
        status: data.status || 'Active',
      },
    });
  }

  async updateSlot(schoolId, id, data) {
    await this.getSlotById(schoolId, id);

    const updateData = {};
    if (data.cls !== undefined) updateData.cls = String(data.cls).trim();
    if (data.section !== undefined) updateData.section = String(data.section).trim();
    if (data.day !== undefined) updateData.day = String(data.day).trim();
    if (data.period !== undefined) updateData.period = Number(data.period);
    if (data.startTime !== undefined) updateData.startTime = data.startTime ? String(data.startTime).trim() : null;
    if (data.endTime !== undefined) updateData.endTime = data.endTime ? String(data.endTime).trim() : null;
    if (data.subject !== undefined) updateData.subject = String(data.subject).trim();
    if (data.teacher !== undefined) updateData.teacher = String(data.teacher).trim();
    if (data.teacherId !== undefined) updateData.teacherId = data.teacherId;
    if (data.room !== undefined) updateData.room = data.room ? String(data.room).trim() : null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.branchId !== undefined) updateData.branchId = data.branchId;

    return prisma.timetableSlot.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteSlot(schoolId, id) {
    await this.getSlotById(schoolId, id);
    await prisma.timetableSlot.delete({ where: { id } });
    return true;
  }
}

module.exports = new TimetableService();
