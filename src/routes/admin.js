const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Dashboard statistics & recent activities
router.get('/dashboard', adminController.getDashboardStats);

// Users management (Search, Filter by Role/Status, Activate/Suspend)
router.get('/users', adminController.getUsers);
router.put('/users/:id/status', adminController.updateUserStatus);

// Employers management (Search, Filter by Type/Status, Approve/Suspend)
router.get('/employers', adminController.getEmployers);
router.put('/employers/:id/status', adminController.updateEmployerStatus);

// Jobs moderation (Search, Filter by Status, Approve/Pause/Close/Suspend/Delete)
router.get('/jobs', adminController.getJobs);
router.put('/jobs/:id/status', adminController.updateJobStatus);
router.delete('/jobs/:id', adminController.deleteJob);

// Applications moderation & platform support
router.get('/applications', adminController.getApplications);
router.put('/applications/:id/status', adminController.updateApplicationStatus);

// Reports management (Fake jobs, Fake organisations, Spam, Content)
router.get('/reports', adminController.getReports);
router.post('/reports', adminController.createReport);
router.put('/reports/:id/status', adminController.updateReportStatus);

module.exports = router;
