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

describe('Admin Dashboard Service Tests', () => {
  it('should list users', async () => {
    const response = await request(app).get('/admin/users');
    expect(response.status).toBe(200);
  });

  it('should log admin actions', async () => {
    const response = await request(app)
      .post('/admin/audit-log')
      .send({ action: 'Test Action', details: 'Test Details' });
    expect(response.status).toBe(201);
  });
});