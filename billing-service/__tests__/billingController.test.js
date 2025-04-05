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

describe('Billing Service Tests', () => {
  it('should create a subscription', async () => {
    const response = await request(app)
      .post('/billing/create-subscription')
      .send({ plan_id: 'test-plan' });
    expect(response.status).toBe(201);
  });

  it('should fetch invoices', async () => {
    const response = await request(app).get('/billing/invoices');
    expect(response.status).toBe(200);
  });

  it('should process a refund', async () => {
    const response = await request(app)
      .post('/billing/refund')
      .send({ subscriptionId: 'test-subscription' });
    expect(response.status).toBe(200);
  });
});