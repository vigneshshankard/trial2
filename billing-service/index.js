const express = require('express');
const billingRoutes = require('./routes/billingRoutes');
const healthcheck = require('express-healthcheck');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());

// Routes
app.use('/api/billing', billingRoutes);

// Health check endpoint
app.use('/health', healthcheck({
  healthy: () => ({
    uptime: process.uptime(),
    message: 'Billing Service is healthy',
    memoryUsage: process.memoryUsage()
  })
}));

app.get('/', (req, res) => {
  res.send('Billing Service is running');
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