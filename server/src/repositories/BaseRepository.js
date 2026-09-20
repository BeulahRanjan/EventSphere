/**
 * BaseRepository providing standard database operations for Mongoose models.
 * Encapsulates direct database access away from service logic.
 */

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, projection = null, options = {}) {
    return this.model.findById(id, projection, options);
  }

  async findOne(filter, projection = null, options = {}) {
    return this.model.findOne(filter, projection, options);
  }

  async find(filter = {}, projection = null, options = {}) {
    return this.model.find(filter, projection, options);
  }

  async create(data, options = {}) {
    if (options.session) {
      const [created] = await this.model.create([data], { session: options.session });
      return created;
    }
    return this.model.create(data);
  }

  async insertMany(dataArray, options = {}) {
    return this.model.insertMany(dataArray, options);
  }

  async updateById(id, update, options = { new: true, runValidators: true }) {
    return this.model.findByIdAndUpdate(id, update, options);
  }

  async updateOne(filter, update, options = {}) {
    return this.model.updateOne(filter, update, options);
  }

  async updateMany(filter, update, options = {}) {
    return this.model.updateMany(filter, update, options);
  }

  async deleteById(id, options = {}) {
    return this.model.findByIdAndDelete(id, options);
  }

  async count(filter = {}) {
    return this.model.countDocuments(filter);
  }

  async paginate(filter = {}, { page = 1, limit = 10, sort = { createdAt: -1 }, populate = null }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    let query = this.model.find(filter).sort(sort).skip(skip).limit(limitNum);
    if (populate) {
      query = query.populate(populate);
    }

    const [items, total] = await Promise.all([
      query.exec(),
      this.model.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      hasNextPage: pageNum * limitNum < total,
      hasPrevPage: pageNum > 1,
    };
  }
}

module.exports = BaseRepository;
