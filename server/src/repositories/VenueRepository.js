/**
 * VenueRepository for physical venues and seating layout access.
 */

const BaseRepository = require('./BaseRepository');
const { Venue } = require('../models');

class VenueRepository extends BaseRepository {
  constructor() {
    super(Venue);
  }

  async findByCity(city) {
    return this.model.find({ city: new RegExp(`^${city}$`, 'i') });
  }

  async findByOrganizer(userId) {
    return this.model.find({ createdBy: userId }).sort({ createdAt: -1 });
  }
}

module.exports = new VenueRepository();
