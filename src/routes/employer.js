const express = require('express');
const router = express.Router();
const employerController = require('../controllers/employerController');
const authenticate = require('../middleware/authMiddleware');

router.get('/organisation', authenticate, employerController.getOrganisation);
router.put('/organisation', authenticate, employerController.updateOrganisation);

module.exports = router;
