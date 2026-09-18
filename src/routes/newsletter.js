const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsletterController');
const authenticate = require('../middleware/authMiddleware');

router.get('/status', authenticate.optional, newsletterController.getStatus);
router.post('/subscribe', authenticate.optional, newsletterController.subscribe);
router.post('/unsubscribe', authenticate.optional, newsletterController.unsubscribe);

module.exports = router;
