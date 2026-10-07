const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

/**
 * Hostel Service — manages Hostel Rooms & Bed Occupancy.
 */
class HostelService {
  async listRooms(schoolId, filters = {}) {
    const where = { schoolId };
    if (filters.branchId && filters.branchId !== 'all') {
      where.branchId = filters.branchId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.hostel) {
      where.hostel = { contains: filters.hostel, mode: 'insensitive' };
    }
    if (filters.q) {
      const q = filters.q.trim();
      where.OR = [
        { hostel: { contains: q, mode: 'insensitive' } },
        { room: { contains: q, mode: 'insensitive' } },
        { type: { contains: q, mode: 'insensitive' } },
        { warden: { contains: q, mode: 'insensitive' } },
      ];
    }
    return prisma.hostelRoom.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoomById(schoolId, id) {
    const room = await prisma.hostelRoom.findFirst({
      where: { id, schoolId },
    });
    if (!room) throw notFound('Hostel room not found.');
    return room;
  }

  async createRoom(schoolId, data) {
    if (!data.hostel || !data.room) {
      throw badRequest('Hostel name and room number are required.');
    }
    const beds = Number(data.beds) || 2;
    const occupied = Number(data.occupied) || 0;
    let status = data.status || 'Available';
    if (occupied >= beds) {
      status = 'Occupied';
    } else if (occupied > 0) {
      status = 'Available';
    }

    return prisma.hostelRoom.create({
      data: {
        schoolId,
        branchId: data.branchId || null,
        hostel: data.hostel.trim(),
        room: data.room.trim(),
        type: data.type || 'Double',
        beds,
        occupied,
        warden: data.warden ? data.warden.trim() : null,
        monthlyFee: Number(data.monthlyFee) || 0,
        status,
        residents: Array.isArray(data.residents) ? data.residents : [],
      },
    });
  }

  async updateRoom(schoolId, id, data) {
    const existing = await this.getRoomById(schoolId, id);
    const updateData = {};
    if (data.hostel !== undefined) updateData.hostel = data.hostel.trim();
    if (data.room !== undefined) updateData.room = data.room.trim();
    if (data.type !== undefined) updateData.type = data.type;
    if (data.beds !== undefined) updateData.beds = Number(data.beds) || existing.beds;
    if (data.occupied !== undefined) updateData.occupied = Number(data.occupied);
    if (data.warden !== undefined) updateData.warden = data.warden ? data.warden.trim() : null;
    if (data.monthlyFee !== undefined) updateData.monthlyFee = Number(data.monthlyFee) || 0;
    if (data.residents !== undefined) updateData.residents = Array.isArray(data.residents) ? data.residents : [];
    if (data.branchId !== undefined) updateData.branchId = data.branchId;

    const beds = updateData.beds !== undefined ? updateData.beds : existing.beds;
    const occupied = updateData.occupied !== undefined ? updateData.occupied : existing.occupied;

    if (data.status !== undefined) {
      updateData.status = data.status;
    } else {
      if (occupied >= beds) {
        updateData.status = 'Occupied';
      } else if (existing.status !== 'Blocked') {
        updateData.status = 'Available';
      }
    }

    return prisma.hostelRoom.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteRoom(schoolId, id) {
    await this.getRoomById(schoolId, id);
    await prisma.hostelRoom.delete({ where: { id } });
    return true;
  }
}

module.exports = new HostelService();
