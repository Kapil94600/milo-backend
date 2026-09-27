// ============================================
// Support Service — Tickets + Messages
// ============================================

const { prisma } = require('../config/database');
const AppError = require('../utils/AppError');
const helpers = require('../utils/helpers');
const { logInfo } = require('../utils/logger');
const { SupportStatus } = require('../common/enums');

class SupportService {
  // ============================================
  // Generate ticket number
  // ============================================
  static generateTicketNumber() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `TKT-${yy}${mm}${dd}-${rand}`;
  }

  // ============================================
  // 1. CREATE TICKET
  // ============================================
  static async createTicket(userId, data) {
    const { subject, category, priority = 'MEDIUM', description, attachments = [], ip, userAgent } = data;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        ticketNumber: this.generateTicketNumber(),
        subject,
        category,
        priority,
        description,
        attachments,
        status: SupportStatus.OPEN,
      },
    });

    logInfo(`Support ticket created: ${ticket.ticketNumber}`);
    return ticket;
  }

  // ============================================
  // 2. GET TICKETS (admin, with filters)
  // ============================================
  static async getTickets({ page = 1, limit = 20, status, category, priority, search } = {}) {
    const where = { deletedAt: null };
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      data: tickets,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 3. GET MY TICKETS
  // ============================================
  static async getMyTickets(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where: { userId, deletedAt: null },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supportTicket.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      data: tickets,
      pagination: helpers.buildPagination(page, limit, total),
    };
  }

  // ============================================
  // 4. GET TICKET BY ID
  // ============================================
  static async getTicketById(ticketId, userId) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket || ticket.deletedAt) throw AppError.notFound('Ticket not found');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === 'ADMIN';

    if (!isAdmin && ticket.userId !== userId) {
      throw AppError.forbidden('Not authorized');
    }

    // Filter internal messages for non-admins
    if (!isAdmin) {
      ticket.messages = ticket.messages.filter((m) => !m.isInternal);
    }

    return ticket;
  }

  // ============================================
  // 5. ADD MESSAGE
  // ============================================
  static async addMessage(ticketId, userId, data) {
    const { message, attachments = [], isInternal = false } = data;

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw AppError.notFound('Ticket not found');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = user?.role === 'ADMIN';

    if (!isAdmin && ticket.userId !== userId) {
      throw AppError.forbidden('Not authorized');
    }

    if (ticket.status === SupportStatus.CLOSED && !isAdmin) {
      throw AppError.badRequest('Ticket is closed. Please create a new one.');
    }

    // Determine senderRole
    let senderRole = 'USER';
    if (isAdmin) senderRole = 'ADMIN';
    else if (user?.role === 'GIRL') senderRole = 'GIRL';

    const supportMessage = await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId: userId,
        senderRole,
        message,
        attachments,
        isInternal: isAdmin ? isInternal : false,
      },
    });

    // Update ticket status to IN_PROGRESS if not closed
    if (ticket.status === SupportStatus.OPEN) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: SupportStatus.IN_PROGRESS },
      });
    }

    return supportMessage;
  }

  // ============================================
  // 6. UPDATE TICKET STATUS (admin)
  // ============================================
  static async updateTicketStatus(ticketId, status, adminId, resolution = null) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw AppError.notFound('Ticket not found');

    const updates = { status };

    if (status === SupportStatus.RESOLVED) {
      updates.resolvedAt = new Date();
      if (resolution) updates.resolution = resolution;
    }
    if (status === SupportStatus.CLOSED) {
      updates.closedAt = new Date();
    }

    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: updates,
    });
  }

  // ============================================
  // 7. ASSIGN TICKET (admin)
  // ============================================
  static async assignTicket(ticketId, adminId) {
    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId: adminId },
    });
  }

  // ============================================
  // 8. RATE TICKET
  // ============================================
  static async rateTicket(ticketId, userId, rating, feedback = null) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw AppError.notFound('Ticket not found');

    if (ticket.userId !== userId) throw AppError.forbidden('Not authorized');

    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: { rating, feedback },
    });
  }

  // ============================================
  // 9. STATS (admin)
  // ============================================
  static async getStats() {
    const [total, open, inProgress, resolved, closed, avgRating] = await Promise.all([
      prisma.supportTicket.count({ where: { deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'OPEN', deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED', deletedAt: null } }),
      prisma.supportTicket.count({ where: { status: 'CLOSED', deletedAt: null } }),
      prisma.supportTicket.aggregate({
        where: { rating: { not: null } },
        _avg: { rating: true },
      }),
    ]);

    return {
      total,
      open,
      inProgress,
      resolved,
      closed,
      averageRating: avgRating._avg.rating || 0,
    };
  }

  // ============================================
  // 10. DELETE TICKET (admin)
  // ============================================
  static async deleteTicket(ticketId) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw AppError.notFound('Ticket not found');

    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: { deletedAt: new Date() },
    });
  }
}

module.exports = SupportService;