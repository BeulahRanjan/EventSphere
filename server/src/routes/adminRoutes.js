/**
 * Admin Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/AdminController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

// Enforce ADMIN role across all admin routes
router.use(authMiddleware, authorizeRoles('ADMIN'));

router.get('/analytics', adminController.getAnalytics);
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.toggleUserStatus);
router.patch('/events/:id/status', adminController.moderateEvent);
router.post('/categories', adminController.createCategory);
router.post('/venues', adminController.createVenue);

module.exports = router;
