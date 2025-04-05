const router = require('express').Router();

router.get('/advanced', authMiddleware, analyticsController.getAdvancedAnalytics);
router.post('/predict', authMiddleware, analyticsController.predictCompletionDate);

module.exports = router;