/**
 * Comprehensive Database Seed Script for EventSphere.
 * Populates realistic users (Admin, Organizer, User), categories, venues,
 * published events, and interactive seating configurations with pricing tiers.
 */

const path = require('path');
module.paths.push(path.resolve(__dirname, '../server/node_modules'));

const mongoose = require('mongoose');
const config = require('../server/src/config/env');
const {
  User,
  EventCategory,
  Venue,
  Event,
  Seat,
  Booking,
  Payment,
  Ticket,
  Notification,
  NotificationPreference,
} = require('../server/src/models');
const logger = require('../server/src/config/logger');

async function seed() {
  try {
    logger.info('Connecting to MongoDB for seeding...');
    await mongoose.connect(config.mongodb.uri);
    logger.info('MongoDB connected.');

    // Clear existing collections
    logger.info('Purging existing data...');
    await Promise.all([
      User.deleteMany({}),
      EventCategory.deleteMany({}),
      Venue.deleteMany({}),
      Event.deleteMany({}),
      Seat.deleteMany({}),
      Booking.deleteMany({}),
      Payment.deleteMany({}),
      Ticket.deleteMany({}),
      Notification.deleteMany({}),
      NotificationPreference.deleteMany({}),
    ]);

    // 1. Create Event Categories
    logger.info('Seeding Event Categories...');
    const categoriesData = [
      { name: 'Music', slug: 'music', icon: 'Music', description: 'Live concerts, music festivals, acoustic gigs, and electronic dance music.' },
      { name: 'Comedy', slug: 'comedy', icon: 'Smile', description: 'Stand-up specials, improv comedy, roasts, and open mics.' },
      { name: 'Technology', slug: 'technology', icon: 'Cpu', description: 'Developer conferences, hackathons, AI summits, and tech expos.' },
      { name: 'Sports', slug: 'sports', icon: 'Trophy', description: 'Cricket, football, badminton tournaments, and live esports.' },
      { name: 'Theater', slug: 'theater', icon: 'Theater', description: 'Broadway productions, drama plays, musicals, and classical dance.' },
      { name: 'Workshops', slug: 'workshops', icon: 'BookOpen', description: 'Masterclasses, hands-on coding workshops, culinary, and photography.' },
    ];

    const categories = await EventCategory.insertMany(categoriesData);
    const catMap = {};
    categories.forEach((c) => (catMap[c.slug] = c._id));

    // 2. Create Seed Users
    logger.info('Seeding Users...');
    const users = await User.create([
      {
        name: 'Admin Controller',
        email: 'admin@eventsphere.com',
        password: 'Admin@123Password',
        role: 'ADMIN',
        phone: '+91 9876543210',
        preferredLocations: ['Mumbai', 'Bengaluru', 'Pune'],
        preferredCategories: [catMap['music'], catMap['technology']],
      },
      {
        name: 'Apex Experiences (Organizer)',
        email: 'organizer@eventsphere.com',
        password: 'Organizer@123Password',
        role: 'EVENT_ORGANIZER',
        phone: '+91 9876543211',
        preferredLocations: ['Mumbai', 'Pune'],
        preferredCategories: [catMap['music'], catMap['comedy']],
      },
      {
        name: 'John Doe',
        email: 'user@eventsphere.com',
        password: 'User@123Password',
        role: 'USER',
        phone: '+91 9876543212',
        preferredLocations: ['Pune', 'Mumbai', 'Bhubaneswar'],
        preferredCategories: [catMap['music'], catMap['technology'], catMap['comedy']],
      },
    ]);

    const admin = users[0];
    const organizer = users[1];
    const customer = users[2];

    // Seed Notification Preferences for users
    for (const u of users) {
      await NotificationPreference.create({ user: u._id });
    }

    // 3. Create Venues with Seating Configurations
    logger.info('Seeding Venues with Seating Layouts...');
    const venuesData = [
      {
        name: 'Bal Gandharva Ranga Mandir',
        address: 'JM Road, Shivajinagar',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411005',
        totalCapacity: 50,
        createdBy: organizer._id,
        seatingLayout: {
          sections: [
            { name: 'VIP Front Row', tier: 'VIP', rows: 1, seatsPerRow: 10 },
            { name: 'Executive Terrace', tier: 'PREMIUM', rows: 2, seatsPerRow: 10 },
            { name: 'General Gallery', tier: 'REGULAR', rows: 2, seatsPerRow: 10 },
          ],
        },
      },
      {
        name: 'Jio World Convention Centre',
        address: 'G Block, Bandra Kurla Complex',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400051',
        totalCapacity: 60,
        createdBy: organizer._id,
        seatingLayout: {
          sections: [
            { name: 'Diamond VIP Box', tier: 'VIP', rows: 2, seatsPerRow: 10 },
            { name: 'Gold Club', tier: 'PREMIUM', rows: 2, seatsPerRow: 10 },
            { name: 'Silver Hall', tier: 'REGULAR', rows: 2, seatsPerRow: 10 },
          ],
        },
      },
      {
        name: 'Kanteerava Indoor Arena',
        address: 'Kasturba Road, Sampangi Rama Nagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        totalCapacity: 50,
        createdBy: organizer._id,
        seatingLayout: {
          sections: [
            { name: 'Court-side VIP', tier: 'VIP', rows: 1, seatsPerRow: 10 },
            { name: 'Lower Tier', tier: 'PREMIUM', rows: 2, seatsPerRow: 10 },
            { name: 'Upper Tier', tier: 'REGULAR', rows: 2, seatsPerRow: 10 },
          ],
        },
      },
      {
        name: 'Kalinga Convention Centre',
        address: 'Jayadev Vihar, Chandrasekharpur',
        city: 'Bhubaneswar',
        state: 'Odisha',
        postalCode: '751013',
        totalCapacity: 50,
        createdBy: organizer._id,
        seatingLayout: {
          sections: [
            { name: 'Executive Front', tier: 'VIP', rows: 1, seatsPerRow: 10 },
            { name: 'Central Pavilion', tier: 'PREMIUM', rows: 2, seatsPerRow: 10 },
            { name: 'Open Balcony', tier: 'REGULAR', rows: 2, seatsPerRow: 10 },
          ],
        },
      },
    ];

    const venues = await Venue.insertMany(venuesData);
    const venuePune = venues[0];
    const venueMumbai = venues[1];
    const venueBlr = venues[2];
    const venueBhub = venues[3];

    // 4. Create Events
    logger.info('Seeding Events and Generating Interactive Seats...');
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    const eventsData = [
      {
        title: 'Sunburn Electronic Music Festival 2026',
        slug: 'sunburn-electronic-music-festival-2026',
        description: 'Asia’s premier electronic dance music festival returns with international headliners, immersive 3D stage production, lasers, and bass that reverberates throughout the arena.',
        category: catMap['music'],
        organizer: organizer._id,
        venue: venuePune._id,
        status: 'PUBLISHED',
        bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
        ],
        startDate: new Date(now.getTime() + 4 * day),
        endDate: new Date(now.getTime() + 4 * day + 6 * 3600 * 1000),
        pricingTiers: [
          { tier: 'VIP', price: 2999, capacity: 10, availableCount: 10 },
          { tier: 'PREMIUM', price: 1799, capacity: 20, availableCount: 20 },
          { tier: 'REGULAR', price: 899, capacity: 20, availableCount: 20 },
        ],
        totalCapacity: 50,
        availableSeatsCount: 50,
        cancellationPolicy: 'Refundable up to 48 hours prior to the festival start.',
        tags: ['EDM', 'Sunburn', 'Festival', 'Pune', 'Nightlife'],
        badges: ['TRENDING', 'POPULAR'],
        isFeatured: true,
        trendingScore: 98,
      },
      {
        title: 'Zakir Khan Live - Tathastu & Beyond Special',
        slug: 'zakir-khan-live-mumbai-2026',
        description: 'The Sakht Launda himself returns to Mumbai for an intimate 90-minute evening of observational humor, heart-warming stories, and unfiltered laughs.',
        category: catMap['comedy'],
        organizer: organizer._id,
        venue: venueMumbai._id,
        status: 'PUBLISHED',
        bannerUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=1200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80'],
        startDate: new Date(now.getTime() + 7 * day),
        endDate: new Date(now.getTime() + 7 * day + 2 * 3600 * 1000),
        pricingTiers: [
          { tier: 'VIP', price: 2499, capacity: 20, availableCount: 20 },
          { tier: 'PREMIUM', price: 1499, capacity: 20, availableCount: 20 },
          { tier: 'REGULAR', price: 799, capacity: 20, availableCount: 20 },
        ],
        totalCapacity: 60,
        availableSeatsCount: 60,
        cancellationPolicy: 'Non-refundable within 24 hours of event start.',
        tags: ['Comedy', 'Standup', 'Zakir Khan', 'Mumbai'],
        badges: ['POPULAR'],
        isFeatured: true,
        trendingScore: 89,
      },
      {
        title: 'Global AI & Cloud Architecture Summit 2026',
        slug: 'global-ai-cloud-summit-2026',
        description: 'Connect with lead AI researchers, system architects, and cloud infrastructure pioneers. Keynotes on large foundation models, Redis distributed patterns, and high-concurrency systems.',
        category: catMap['technology'],
        organizer: organizer._id,
        venue: venueBlr._id,
        status: 'PUBLISHED',
        bannerUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&auto=format&fit=crop&q=80'],
        startDate: new Date(now.getTime() + 12 * day),
        endDate: new Date(now.getTime() + 13 * day),
        pricingTiers: [
          { tier: 'VIP', price: 4999, capacity: 10, availableCount: 10 },
          { tier: 'PREMIUM', price: 2499, capacity: 20, availableCount: 20 },
          { tier: 'REGULAR', price: 999, capacity: 20, availableCount: 20 },
        ],
        totalCapacity: 50,
        availableSeatsCount: 50,
        cancellationPolicy: '100% refund up to 7 days before summit.',
        tags: ['AI', 'Tech', 'Cloud', 'Architecture', 'Bengaluru'],
        badges: ['UPCOMING', 'NEW'],
        isFeatured: true,
        trendingScore: 85,
      },
      {
        title: 'Odisha Heritage & Sufi Fusion Night',
        slug: 'odisha-heritage-sufi-fusion-2026',
        description: 'A magical night blending classical Odissi musical arrangements with modern soulful Sufi poetry under the starlit open-air amphitheater.',
        category: catMap['music'],
        organizer: organizer._id,
        venue: venueBhub._id,
        status: 'PUBLISHED',
        bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&auto=format&fit=crop&q=80'],
        startDate: new Date(now.getTime() + 3 * day),
        endDate: new Date(now.getTime() + 3 * day + 4 * 3600 * 1000),
        pricingTiers: [
          { tier: 'VIP', price: 1499, capacity: 10, availableCount: 10 },
          { tier: 'PREMIUM', price: 899, capacity: 20, availableCount: 20 },
          { tier: 'REGULAR', price: 499, capacity: 20, availableCount: 20 },
        ],
        totalCapacity: 50,
        availableSeatsCount: 50,
        cancellationPolicy: 'Standard cancellation policy applies.',
        tags: ['Music', 'Sufi', 'Heritage', 'Bhubaneswar'],
        badges: ['NEW', 'LIVE'],
        isFeatured: false,
        trendingScore: 78,
      },
    ];

    const events = await Event.insertMany(eventsData);

    // Generate physical interactive seats for each event based on its venue sections
    for (const event of events) {
      const v = venues.find((v) => v._id.toString() === event.venue.toString());
      const seatsToInsert = [];

      for (const section of v.seatingLayout.sections) {
        const tierPrice = event.pricingTiers.find((t) => t.tier === section.tier)?.price || 499;

        for (let r = 1; r <= section.rows; r++) {
          const rowLetter = String.fromCharCode(64 + r); // A, B, C...
          for (let s = 1; s <= section.seatsPerRow; s++) {
            seatsToInsert.push({
              eventId: event._id,
              venueId: v._id,
              section: section.name,
              row: rowLetter,
              seatNumber: s,
              tier: section.tier,
              price: tierPrice,
              status: 'AVAILABLE',
            });
          }
        }
      }

      await Seat.insertMany(seatsToInsert);
      logger.info(`Generated ${seatsToInsert.length} interactive seats for event: ${event.title}`);
    }

    // 5. Seed Welcome Notification for customer
    await Notification.create({
      user: customer._id,
      type: 'NEW_LOCAL_EVENT',
      title: 'Welcome to EventSphere!',
      message: 'Explore upcoming live concerts, comedy specials, and tech summits in Pune & Mumbai.',
      data: { welcome: true },
    });

    logger.info('Database seeded successfully!');
    logger.info('----------------------------------------------------');
    logger.info('Default Credentials for Testing:');
    logger.info('  Admin:     admin@eventsphere.com     / Admin@123Password');
    logger.info('  Organizer: organizer@eventsphere.com / Organizer@123Password');
    logger.info('  Customer:  user@eventsphere.com      / User@123Password');
    logger.info('----------------------------------------------------');

    process.exit(0);
  } catch (error) {
    logger.error('Seeding error', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

seed();
