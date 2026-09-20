/**
 * Auth & RBAC Integration Tests for EventSphere.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/env');
const { redisClient } = require('../src/config/redis');

describe('Auth & RBAC Endpoints', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongodb.uri);
    }
  });

  afterAll(async () => {
    await redisClient.quit();
    await mongoose.connection.close();
  });

  const testUser = {
    name: 'Integration Test User',
    email: `test-${Date.now()}@eventsphere.com`,
    password: 'Password@123',
    role: 'USER',
    preferredLocations: ['Pune'],
  };

  let accessToken = '';
  let refreshToken = '';

  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('should reject registration with duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should authenticate user and return JWT tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('should fetch user profile with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email.toLowerCase());
  });

  it('should reject protected route without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('should refresh access token using valid refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('should reject non-admin access to admin analytics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(403);
  });
});
