const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const authenticate = require('../middleware/authMiddleware');

// Dashboard statistics
router.get('/stats', authenticate, candidateController.getDashboardStats);

// Profile
router.get('/profile', authenticate, candidateController.getProfile);
router.put('/profile', authenticate, candidateController.updateProfile);

// Education CRUD
router.post('/education', authenticate, candidateController.addEducation);
router.put('/education/:id', authenticate, candidateController.updateEducation);
router.delete('/education/:id', authenticate, candidateController.deleteEducation);

// Experience CRUD
router.post('/experience', authenticate, candidateController.addExperience);
router.put('/experience/:id', authenticate, candidateController.updateExperience);
router.delete('/experience/:id', authenticate, candidateController.deleteExperience);

// Skills
router.post('/skills', authenticate, candidateController.updateSkills);

// Certifications & Registrations CRUD
router.post('/certifications', authenticate, candidateController.addCertification);
router.put('/certifications/:id', authenticate, candidateController.updateCertification);
router.delete('/certifications/:id', authenticate, candidateController.deleteCertification);

// Resume
router.post('/resume', authenticate, candidateController.uploadResume);
router.delete('/resume', authenticate, candidateController.deleteResume);

// Applications
router.get('/applications', authenticate, candidateController.getApplications);
router.post('/apply', authenticate, candidateController.applyForJob);
router.post('/applications/:id/withdraw', authenticate, candidateController.withdrawApplication);

// Saved Jobs
router.get('/saved-jobs', authenticate, candidateController.getSavedJobs);
router.post('/saved-jobs/:jobId', authenticate, candidateController.toggleSaveJob);

// Interviews
router.get('/interviews', authenticate, candidateController.getInterviews);

// Settings
router.get('/settings', authenticate, candidateController.getSettings);
router.put('/settings', authenticate, candidateController.updateSettings);

module.exports = router;
