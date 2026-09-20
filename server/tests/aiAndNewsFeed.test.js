/**
 * AI Assistant & Event News Feed Integration Tests.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/env');
const { redisClient } = require('../src/config/redis');

describe('AI Assistant & News Feed Endpoints', () => {
  let userToken = '';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongodb.uri);
    }

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'user@eventsphere.com',
      password: 'User@123Password',
    });
    userToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await redisClient.quit();
    await mongoose.connection.close();
  });

  it('1. should fetch personalized Event News Feed with location highlights', async () => {
    const res = await request(app)
      .get('/api/v1/feed?city=Pune')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location).toBe('Pune');
    expect(Array.isArray(res.body.data.trending)).toBe(true);
    expect(Array.isArray(res.body.data.upcoming)).toBe(true);
  });

  it('2. should fetch rule-based personalized event recommendations', async () => {
    const res = await request(app)
      .get('/api/v1/feed/recommendations')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('3. should process natural language query in AI Event Assistant (Location & Music intent)', async () => {
    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        message: 'Find music events in Pune under 3000',
        conversationId: 'test-session-1',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.toolUsed).toBe('searchEvents');
    expect(res.body.data.reply).toBeDefined();
    expect(typeof res.body.data.reply).toBe('string');
  });

  it('4. should process booking inquiry in AI Assistant', async () => {
    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        message: 'Show me my bookings',
        conversationId: 'test-session-1',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.toolUsed).toBe('getUserBookings');
  });
});
