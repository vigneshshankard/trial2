const request = require('supertest');
const app = require('../index');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Analytics Service Tests', () => {
  it('should fetch advanced analytics', async () => {
    const response = await request(app).get('/analytics/advanced');
    expect(response.status).toBe(200);
  });

  it('should predict completion date', async () => {
    const response = await request(app).post('/analytics/predict');
    expect(response.status).toBe(200);
  });
});