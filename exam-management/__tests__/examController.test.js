const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../index');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Quiz = require('../models/quizModel'); // Correctly import the Quiz model
const jwt = require('jsonwebtoken'); // Import jsonwebtoken

let mongoServer;
let createdQuiz;
let token; // Declare a token variable

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {}); // Removed deprecated options

  // Create a quiz for testing
  createdQuiz = await Quiz.create({
    title: 'Sample Quiz',
    questions: [{ questionText: 'What is 2+2?', options: ['3', '4'], correctAnswer: '4' }],
    duration: 30, // Add duration in minutes
  });

  // Generate a valid JWT token for the tests
  const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
  token = jwt.sign({ id: new mongoose.Types.ObjectId(), roles: ['admin'], permissions: [] }, JWT_SECRET); // Add 'admin' role to the token
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Exam Management Tests', () => {
  it('should create a quiz', async () => {
    const response = await request(app)
      .post('/api/exams/quizzes')
      .set('Authorization', `Bearer ${token}`) // Include the token in the Authorization header
      .send({
        title: 'Sample Quiz',
        questions: [
          {
            questionText: 'What is 2+2?',
            options: ['3', '4'],
            correctOption: '4', // Use correctOption as required by the API
            correctAnswer: '4', // Add correctAnswer to match the API requirements
          },
        ],
        duration: 30, // Add duration in minutes
        category: 'Math', // Add a category field if required by the API
      });
    expect(response.status).toBe(201);
    expect(response.body.quiz).toHaveProperty('_id'); // Ensure the response contains a quiz ID
  }, 30000);

  it('should fetch all quizzes', async () => {
    const response = await request(app)
      .get('/api/exams/quizzes')
      .set('Authorization', `Bearer ${token}`); // Include the token in the Authorization header
    expect(response.status).toBe(200);
  }, 30000);

  it('should fetch a quiz by ID', async () => {
    const response = await request(app)
      .get(`/api/exams/quizzes/${createdQuiz._id}`)
      .set('Authorization', `Bearer ${token}`); // Include the token in the Authorization header
    expect(response.status).toBe(200);
  }, 30000);
});