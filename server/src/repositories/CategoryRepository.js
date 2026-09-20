/**
 * CategoryRepository for event category retrieval and management.
 */

const BaseRepository = require('./BaseRepository');
const { EventCategory } = require('../models');

class CategoryRepository extends BaseRepository {
  constructor() {
    super(EventCategory);
  }

  async findBySlug(slug) {
    return this.model.findOne({ slug: slug.toLowerCase() });
  }

  async findActiveCategories() {
    return this.model.find({ isActive: true }).sort({ name: 1 });
  }
}

module.exports = new CategoryRepository();
