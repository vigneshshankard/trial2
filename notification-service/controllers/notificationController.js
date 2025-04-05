const Notification = require('../models/notificationModel');
const request = require('supertest');
const app = require('../index');
const { validationResult } = require('express-validator');
const { createCircuitBreaker } = require('circuit-breaker');

// Send a notification with circuit breaker
exports.sendNotification = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { userId, type, message } = req.body;
        const notification = { userId, type, message };

        // Use circuit breaker for sending notification
        const notificationDispatcher = req.app.get('notificationDispatcher');
        await notificationDispatcher.fire(notification);

        const savedNotification = await new Notification(notification).save();
        res.status(201).json({ 
            message: 'Notification sent successfully',
            notification: savedNotification 
        });
    } catch (error) {
        if (error.type === 'circuit-breaker') {
            return res.status(503).json({
                message: 'Notification service temporarily unavailable',
                error: error.message
            });
        }
        console.error('Error in sendNotification:', error);
        next(error);
    }
};

// Get notifications for a user with circuit breaker
exports.getNotifications = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const fetchNotifications = async () => {
            return await Notification.find({ userId: req.params.userId });
        };

        const notificationBreaker = createCircuitBreaker(fetchNotifications, {
            timeout: 2000,
            errorThresholdPercentage: 20,
            resetTimeout: 5000
        });

        const notifications = await notificationBreaker.fire();
        res.status(200).json(notifications);
    } catch (error) {
        if (error.type === 'circuit-breaker') {
            return res.status(503).json({
                message: 'Unable to fetch notifications at this time',
                error: error.message
            });
        }
        console.error('Error in getNotifications:', error);
        next(error);
    }
};

// Get priority notifications for Subscribers
exports.getPriorityNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({ type: 'priority' });
        res.status(200).json(notifications);
    } catch (error) {
        console.error('Error in getPriorityNotifications:', error);
        next(error); // Pass error to global error handler
    }
};

// Update notification preferences for users
exports.updateNotificationPreferences = async (req, res, next) => {
  try {
    const { email_enabled, sms_enabled, in_app_enabled } = req.body;
    const userId = req.user.id;

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user_id: userId },
      { email_enabled, sms_enabled, in_app_enabled },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: 'Preferences updated successfully', preferences });
  } catch (error) {
    console.error('Error in updateNotificationPreferences:', error);
    next(error);
  }
};