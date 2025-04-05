const express = require('express');
const adminRoutes = require('./routes/adminRoutes');
const healthcheck = require('express-healthcheck');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Routes
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.use('/health', healthcheck({
  healthy: () => ({
    uptime: process.uptime(),
    message: 'Admin Dashboard Service is healthy',
    memoryUsage: process.memoryUsage()
  })
}));

app.get('/', (req, res) => {
  res.send('Admin Dashboard Service is running');
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