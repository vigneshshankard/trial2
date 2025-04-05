const router = require('express').Router();

router.get('/users', authMiddleware, adminController.listUsers);
router.post('/audit-log', authMiddleware, adminController.logAdminAction);

module.exports = router;