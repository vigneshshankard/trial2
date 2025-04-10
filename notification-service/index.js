const express = require('express');
const mongoose = require('mongoose');
const notificationRoutes = require('./routes/notificationRoutes');
const healthcheck = require('express-healthcheck');
const createCircuitBreaker = require('../shared/circuitBreaker');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3004; // Use dynamic port for testing
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/notification';

// Middleware
app.use(express.json());

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Health check endpoint with detailed status
app.use('/health', healthcheck({
  healthy: () => ({
    uptime: process.uptime(),
    message: 'Notification Service is healthy',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    socketConnections: io ? io.engine.clientsCount : 0,
    memoryUsage: process.memoryUsage()
  })
}));

// Circuit breaker for notification dispatch
const withCircuitBreaker = (operation) => {
  const breaker = createCircuitBreaker(operation, {
    timeout: 3000,
    errorThresholdPercentage: 25,
    resetTimeout: 10000
  });
  return breaker;
};

// Create notification dispatcher with circuit breaker
const createNotificationDispatcher = () => {
  const dispatcher = withCircuitBreaker(async (notification) => {
    let retries = 3;
    while (retries > 0) {
      try {
        switch (notification.type) {
          case 'email':
            return await sendEmailNotification(notification);
          case 'push':
            return await sendPushNotification(notification);
          case 'in-app':
            return await sendInAppNotification(notification);
          default:
            throw new Error('Invalid notification type');
        }
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  });

  return dispatcher;
};

// Attach notification dispatcher to app
const notificationDispatcher = createNotificationDispatcher();
app.set('notificationDispatcher', notificationDispatcher);

// Database health check middleware
app.use(async (req, res, next) => {
  if (req.path === '/health') return next();

  const checkDb = async () => {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database connection is not ready');
    }
  };

  const dbBreaker = withCircuitBreaker(checkDb);

  try {
    await dbBreaker.fire();
    next();
  } catch (error) {
    res.status(503).json({
      message: 'Notification service temporarily unavailable',
      error: error.message
    });
  }
});

// MongoDB connection
if (process.env.NODE_ENV !== 'test') {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('MongoDB connected'))
        .catch(err => console.error('MongoDB connection error:', err));
}

// Routes
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
    res.send('Notification Service is running');
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message, '\nStack:', err.stack); // Log error details

    // Standardized error response
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined, // Include stack trace in development
    });
});

// Create HTTP server and initialize Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for now (update in production)
    methods: ['GET', 'POST']
  }
});

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log('A user connected to Notification Service:', socket.id);

  // Example event listener for notifications
  socket.on('send-notification', (data) => {
    console.log('Notification data received:', data);
    io.emit('receive-notification', data); // Broadcast to all connected clients
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected from Notification Service:', socket.id);
  });
});

// Start the server
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        console.log(`Notification Service is running on port ${PORT}`);
    });
}

module.exports = app;