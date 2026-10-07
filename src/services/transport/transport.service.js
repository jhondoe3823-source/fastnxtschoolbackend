const { prisma } = require('../../config/database');
const { notFound, badRequest } = require('../../utils/errors');

class TransportService {

  async listVehicles(schoolId, filters = {}) {
    const where = { schoolId };
    if (filters.branchId && filters.branchId !== 'all') {
      where.branchId = filters.branchId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.q) {
      const q = filters.q.trim();
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { driver: { contains: q, mode: 'insensitive' } },
        { route: { contains: q, mode: 'insensitive' } },
        { type: { contains: q, mode: 'insensitive' } },
      ];
    }
    return prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVehicleById(schoolId, id) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, schoolId },
    });
    if (!vehicle) throw notFound('Vehicle not found.');
    return vehicle;
  }

  async createVehicle(schoolId, data) {
    if (!data.number || !data.driver) {
      throw badRequest('Vehicle registration number and driver name are required.');
    }
    return prisma.vehicle.create({
      data: {
        schoolId,
        branchId: data.branchId || null,
        number: data.number.trim(),
        type: data.type || 'Bus',
        capacity: Number(data.capacity) || 30,
        driver: data.driver.trim(),
        driverPhone: data.driverPhone || null,
        route: data.route || null,
        fitness: data.fitness || null,
        status: data.status || 'Active',
      },
    });
  }

  async updateVehicle(schoolId, id, data) {
    await this.getVehicleById(schoolId, id);
    const updateData = {};
    if (data.number !== undefined) updateData.number = data.number.trim();
    if (data.type !== undefined) updateData.type = data.type;
    if (data.capacity !== undefined) updateData.capacity = Number(data.capacity) || 30;
    if (data.driver !== undefined) updateData.driver = data.driver.trim();
    if (data.driverPhone !== undefined) updateData.driverPhone = data.driverPhone;
    if (data.route !== undefined) updateData.route = data.route;
    if (data.fitness !== undefined) updateData.fitness = data.fitness;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.branchId !== undefined) updateData.branchId = data.branchId;

    return prisma.vehicle.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteVehicle(schoolId, id) {
    await this.getVehicleById(schoolId, id);
    await prisma.vehicle.delete({ where: { id } });
    return true;
  }

  /* ── Transport Routes API ────────────────────────────────────────────────── */

  async listRoutes(schoolId, filters = {}) {
    const where = { schoolId };
    if (filters.branchId && filters.branchId !== 'all') {
      where.branchId = filters.branchId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.q) {
      const q = filters.q.trim();
      where.name = { contains: q, mode: 'insensitive' };
    }
    return prisma.transportRoute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRouteById(schoolId, id) {
    const route = await prisma.transportRoute.findFirst({
      where: { id, schoolId },
    });
    if (!route) throw notFound('Transport Route not found.');
    return route;
  }

  async createRoute(schoolId, data) {
    if (!data.name) {
      throw badRequest('Route name is required.');
    }
    return prisma.transportRoute.create({
      data: {
        schoolId,
        branchId: data.branchId || null,
        name: data.name.trim(),
        stops: Number(data.stops) || 1,
        distance: data.distance || '0 km',
        students: Number(data.students) || 0,
        monthlyFee: Number(data.monthlyFee) || 0,
        vehicleId: data.vehicleId || null,
        status: data.status || 'Active',
      },
    });
  }

  async updateRoute(schoolId, id, data) {
    await this.getRouteById(schoolId, id);
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.stops !== undefined) updateData.stops = Number(data.stops) || 1;
    if (data.distance !== undefined) updateData.distance = data.distance;
    if (data.students !== undefined) updateData.students = Number(data.students) || 0;
    if (data.monthlyFee !== undefined) updateData.monthlyFee = Number(data.monthlyFee) || 0;
    if (data.vehicleId !== undefined) updateData.vehicleId = data.vehicleId || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.branchId !== undefined) updateData.branchId = data.branchId;

    return prisma.transportRoute.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteRoute(schoolId, id) {
    await this.getRouteById(schoolId, id);
    await prisma.transportRoute.delete({ where: { id } });
    return true;
  }

  /** Return minimal vehicle list for dropdown selects */
  async listVehiclesForSelect(schoolId, branchId) {
    const where = { schoolId, status: 'Active' };
    if (branchId && branchId !== 'all') where.branchId = branchId;
    return prisma.vehicle.findMany({
      where,
      select: { id: true, number: true, type: true, driver: true, capacity: true },
      orderBy: { number: 'asc' },
    });
  }
}

module.exports = new TransportService();
