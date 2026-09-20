/**
 * Comprehensive Seat Locking, Concurrency, Booking, Payment, and QR Verification Tests.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/env');
const { redisClient } = require('../src/config/redis');
const { Event, Seat } = require('../src/models');

describe('Seat Locking & Booking Lifecycle Pipeline', () => {
  let user1Token = '';
  let user2Token = '';
  let adminToken = '';
  let eventId = '';
  let testSeat1 = null;
  let testSeat2 = null;
  let bookingId = '';
  let transactionId = '';
  let verificationToken = '';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongodb.uri);
    }

    // 1. Authenticate Seed Users
    const resUser1 = await request(app).post('/api/v1/auth/login').send({
      email: 'user@eventsphere.com',
      password: 'User@123Password',
    });
    user1Token = resUser1.body.data.accessToken;

    // Create second customer for concurrency tests
    const resUser2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Concurrent Booker',
      email: `concurrent-${Date.now()}@eventsphere.com`,
      password: 'Concurrent@123',
    });
    user2Token = resUser2.body.data.accessToken;

    const resAdmin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@eventsphere.com',
      password: 'Admin@123Password',
    });
    adminToken = resAdmin.body.data.accessToken;

    // Pick an existing event
    const event = await Event.findOne({ status: 'PUBLISHED' });
    eventId = event._id.toString();

    // Pick 2 available seats
    const seats = await Seat.find({ eventId, status: 'AVAILABLE' }).limit(2);
    testSeat1 = seats[0];
    testSeat2 = seats[1];
  });

  afterAll(async () => {
    await redisClient.quit();
    await mongoose.connection.close();
  });

  it('1. should fetch interactive seat map for the event', async () => {
    const res = await request(app).get(`/api/v1/seats/${eventId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('2. should allow User 1 to acquire a distributed Redis lock on Seat 1', async () => {
    const res = await request(app)
      .post(`/api/v1/seats/${eventId}/${testSeat1._id}/lock`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('LOCKED');
    expect(res.body.data.isLockedByMe).toBe(true);
    expect(res.body.data.remainingSeconds).toBe(600);
  });

  it('3. should REJECT User 2 attempting to lock the same Seat 1 (Concurrency Protection)', async () => {
    const res = await request(app)
      .post(`/api/v1/seats/${eventId}/${testSeat1._id}/lock`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/currently held by another user/i);
  });

  it('4. should create a temporary booking reservation for User 1', async () => {
    const idempotencyKey = `idemp-booking-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        eventId,
        seatIds: [testSeat1._id.toString()],
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking.status).toBe('RESERVED');
    expect(res.body.data.booking.bookingNumber).toBeDefined();

    bookingId = res.body.data.booking.id;
  });

  it('5. should create an idempotent payment order for the booking', async () => {
    const idempotencyKey = `idemp-pay-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/payments/order')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        bookingId,
        paymentMethod: 'UPI',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment.status).toBe('PENDING');
    expect(res.body.data.payment.transactionId).toBeDefined();

    transactionId = res.body.data.payment.transactionId;
  });

  it('6. should process payment webhook, transition booking to CONFIRMED, and issue QR ticket', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({
        transactionId,
        status: 'SUCCESS',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking.status).toBe('CONFIRMED');
    expect(res.body.data.tickets.length).toBe(1);

    const ticket = res.body.data.tickets[0];
    expect(ticket.status).toBe('VALID');
    expect(ticket.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(ticket.verificationToken).toBeDefined();

    verificationToken = ticket.verificationToken;
  });

  it('7. should return cached result on duplicate webhook submission (Idempotency)', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .send({
        transactionId,
        status: 'SUCCESS',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.booking.status).toBe('CONFIRMED');
  });

  it('8. should allow Organizer/Admin to scan and verify QR ticket token', async () => {
    const res = await request(app)
      .post('/api/v1/tickets/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: verificationToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.ticket.status).toBe('USED');
  });

  it('9. should REJECT duplicate ticket scan at venue gate', async () => {
    const res = await request(app)
      .post('/api/v1/tickets/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: verificationToken });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already used/i);
  });
});
