const router = require('express').Router();

router.post('/create-subscription', authMiddleware, billingController.createSubscription);
router.get('/invoices', authMiddleware, billingController.getInvoices);
router.post('/refund', authMiddleware, billingController.processRefund);

module.exports = router;