/**
 * AdminController for EventSphere.
 * Platform monitoring, event moderation, user management, and revenue analytics.
 */

const { userRepository, eventRepository, bookingRepository, paymentRepository, categoryRepository, venueRepository } = require('../repositories');
const { sendSuccess } = require('../utils/response');
const { NotFoundError } = require('../errors');

class AdminController {
  async getAnalytics(req, res, next) {
    try {
      const [totalUsers, totalEvents, totalBookings, totalRevenueResult, recentBookings] = await Promise.all([
        userRepository.count(),
        eventRepository.count(),
        bookingRepository.count({ status: 'CONFIRMED' }),
        paymentRepository.find({ status: 'SUCCESS' }),
        bookingRepository.find({}, null, {
          sort: { createdAt: -1 },
          limit: 5,
          populate: [
            { path: 'user', select: 'name email' },
            { path: 'event', select: 'title startDate' },
          ],
        }),
      ]);

      const totalRevenue = totalRevenueResult.reduce((sum, p) => sum + p.amount, 0);

      return sendSuccess(res, 'Admin analytics retrieved', {
        metrics: {
          totalUsers,
          totalEvents,
          totalBookings,
          totalRevenue,
        },
        recentBookings,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '15', 10);
      const result = await userRepository.paginate({}, { page, limit, sort: { createdAt: -1 } });
      return sendSuccess(res, 'Users retrieved', result);
    } catch (error) {
      next(error);
    }
  }

  async toggleUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userRepository.findById(id);
      if (!user) {
        throw new NotFoundError('User not found.');
      }

      const updated = await userRepository.updateById(id, { isActive: !user.isActive });
      return sendSuccess(res, `User ${updated.isActive ? 'activated' : 'deactivated'} successfully`, updated);
    } catch (error) {
      next(error);
    }
  }

  async moderateEvent(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await eventRepository.updateById(id, { status });
      return sendSuccess(res, `Event status updated to ${status}`, updated);
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req, res, next) {
    try {
      const slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const category = await categoryRepository.create({ ...req.body, slug });
      return sendSuccess(res, 'Category created', category, 201);
    } catch (error) {
      next(error);
    }
  }

  async createVenue(req, res, next) {
    try {
      const venue = await venueRepository.create({ ...req.body, createdBy: req.user._id });
      return sendSuccess(res, 'Venue created', venue, 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
