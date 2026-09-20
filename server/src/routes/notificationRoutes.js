/**
 * Notification Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/NotificationController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, notificationController.getUserNotifications);
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);
router.patch('/:id/read', authMiddleware, notificationController.markAsRead);
router.post('/read-all', authMiddleware, notificationController.markAllAsRead);

module.exports = router;
