/**
 * EventRepository for high-performance indexed queries, aggregation, and inventory updates.
 */

const BaseRepository = require('./BaseRepository');
const { Event } = require('../models');

class EventRepository extends BaseRepository {
  constructor() {
    super(Event);
  }

  async findBySlug(slug) {
    return this.model.findOne({ slug })
      .populate('category', 'name slug icon')
      .populate('venue')
      .populate('organizer', 'name email phone');
  }

  async findByIdDetailed(id) {
    return this.model.findById(id)
      .populate('category', 'name slug icon')
      .populate('venue')
      .populate('organizer', 'name email phone');
  }

  async searchAndFilter({
    search,
    category,
    city,
    startDate,
    endDate,
    minPrice,
    maxPrice,
    status = 'PUBLISHED',
    sortBy = 'startDate',
    sortOrder = 'asc',
    page = 1,
    limit = 12,
  }) {
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter['pricingTiers.price'] = {};
      if (minPrice !== undefined) filter['pricingTiers.price'].$gte = Number(minPrice);
      if (maxPrice !== undefined) filter['pricingTiers.price'].$lte = Number(maxPrice);
    }

    if (search && search.trim()) {
      filter.$text = { $search: search.trim() };
    }

    // Determine sorting
    const sort = {};
    const direction = sortOrder === 'desc' ? -1 : 1;

    if (sortBy === 'price') {
      sort['pricingTiers.price'] = direction;
    } else if (sortBy === 'trending') {
      sort.trendingScore = -1;
    } else if (sortBy === 'popular') {
      sort.availableSeatsCount = 1; // fewer available = more popular/booked
    } else if (sortBy === 'newest') {
      sort.createdAt = -1;
    } else {
      sort.startDate = direction;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    // Execute query with populate
    let query = this.model.find(filter)
      .populate('category', 'name slug icon')
      .populate({
        path: 'venue',
        match: city ? { city: new RegExp(`^${city}$`, 'i') } : {},
      })
      .populate('organizer', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const items = await query.exec();
    // If city was filtered via populate match, filter out null venues
    const filteredItems = city ? items.filter(item => item.venue !== null) : items;
    const total = await this.model.countDocuments(filter);

    return {
      items: filteredItems,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findTrending(limit = 6) {
    return this.model.find({ status: 'PUBLISHED' })
      .sort({ trendingScore: -1, createdAt: -1 })
      .limit(limit)
      .populate('category', 'name slug icon')
      .populate('venue', 'name city state');
  }

  async findUpcoming(limit = 6) {
    const now = new Date();
    return this.model.find({ status: 'PUBLISHED', startDate: { $gte: now } })
      .sort({ startDate: 1 })
      .limit(limit)
      .populate('category', 'name slug icon')
      .populate('venue', 'name city state');
  }

  async findPopular(limit = 6) {
    return this.model.find({ status: 'PUBLISHED' })
      .sort({ isFeatured: -1, trendingScore: -1, availableSeatsCount: 1 })
      .limit(limit)
      .populate('category', 'name slug icon')
      .populate('venue', 'name city state');
  }

  async findByOrganizer(organizerId) {
    return this.model.find({ organizer: organizerId })
      .sort({ createdAt: -1 })
      .populate('category', 'name slug')
      .populate('venue', 'name city');
  }

  async decrementAvailableSeats(eventId, count = 1, session = null) {
    const options = session ? { session } : {};
    return this.model.findByIdAndUpdate(
      eventId,
      {
        $inc: { availableSeatsCount: -count, trendingScore: count * 5 },
      },
      { new: true, ...options }
    );
  }

  async incrementAvailableSeats(eventId, count = 1, session = null) {
    const options = session ? { session } : {};
    return this.model.findByIdAndUpdate(
      eventId,
      {
        $inc: { availableSeatsCount: count },
      },
      { new: true, ...options }
    );
  }
}

module.exports = new EventRepository();
