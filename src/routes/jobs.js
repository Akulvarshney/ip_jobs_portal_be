const express = require('express');
const router = express.Router();
const jobsController = require('../controllers/jobsController');
const authenticate = require('../middleware/authMiddleware');

// Public endpoints (with optional authentication so guests can browse)
router.get('/', authenticate.optional, jobsController.getAllJobs);
router.get('/company/:id', authenticate.optional, jobsController.getCompanyById);
router.get('/:id', authenticate.optional, jobsController.getJobById);

// Protected employer endpoints
router.get('/employer', authenticate, jobsController.getEmployerJobs);
router.post('/', authenticate, jobsController.createJob);
router.put('/:id', authenticate, jobsController.updateJob);

module.exports = router;
