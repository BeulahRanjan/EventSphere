/**
 * Central API V1 Route Router for EventSphere.
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const eventRoutes = require('./eventRoutes');
const seatRoutes = require('./seatRoutes');
const bookingRoutes = require('./bookingRoutes');
const paymentRoutes = require('./paymentRoutes');
const ticketRoutes = require('./ticketRoutes');
const notificationRoutes = require('./notificationRoutes');
const newsFeedRoutes = require('./newsFeedRoutes');
const aiRoutes = require('./aiRoutes');
const adminRoutes = require('./adminRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/seats', seatRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/tickets', ticketRoutes);
router.use('/notifications', notificationRoutes);
router.use('/feed', newsFeedRoutes);
router.use('/ai', aiRoutes);
router.use('/admin', adminRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EventSphere API Gateway healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

module.exports = router;
