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

describe('Current Affairs Service Tests', () => {
  it('should fetch quiz for a current affair', async () => {
    const response = await request(app).get('/current-affairs/1/quiz');
    expect(response.status).toBe(200);
  });
});