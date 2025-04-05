const express = require('express');
const analyticsRoutes = require('./routes/analyticsRoutes');
const healthcheck = require('express-healthcheck');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());

// Routes
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.use('/health', healthcheck({
  healthy: () => ({
    uptime: process.uptime(),
    message: 'Analytics Service is healthy',
    memoryUsage: process.memoryUsage()
  })
}));

app.get('/', (req, res) => {
  res.send('Analytics Service is running');
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;