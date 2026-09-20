/**
 * NewsFeed & Recommendations Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const newsFeedController = require('../controllers/NewsFeedController');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

router.get('/', optionalAuthMiddleware, newsFeedController.getFeed);
router.get('/recommendations', optionalAuthMiddleware, newsFeedController.getRecommendations);
router.post(
  '/external/ingest',
  authMiddleware,
  authorizeRoles('ADMIN'),
  newsFeedController.ingestExternal
);

module.exports = router;
