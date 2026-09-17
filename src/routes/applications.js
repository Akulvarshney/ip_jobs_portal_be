const express = require('express');
const router = express.Router();
const applicationsController = require('../controllers/applicationsController');
const authenticate = require('../middleware/authMiddleware');

router.post('/apply', authenticate, applicationsController.applyJob);
router.get('/employer', authenticate, applicationsController.getEmployerApplications);
router.get('/job/:jobId', authenticate, applicationsController.getJobApplications);
router.put('/:id/status', authenticate, applicationsController.updateStatus);
router.post('/:id/schedule-interview', authenticate, applicationsController.scheduleInterview);
router.post('/:id/invite', authenticate, applicationsController.sendInvite);

module.exports = router;
