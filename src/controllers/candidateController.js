const prisma = require('../prisma');
const bcrypt = require('bcrypt');

// Helper to ensure candidate profile exists
async function getOrCreateCandidateProfile(userId) {
  let profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      educations: { orderBy: { completionYear: 'desc' } },
      experiences: { orderBy: { startDate: 'desc' } },
      skills: { include: { skill: true } },
      certifications: { orderBy: { id: 'desc' } },
    }
  });

  if (!profile) {
    profile = await prisma.candidateProfile.create({
      data: {
        userId,
        visibility: 'PUBLIC'
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        educations: true,
        experiences: true,
        skills: { include: { skill: true } },
        certifications: true,
      }
    });
  }

  return profile;
}

/**
 * Robust, transparent calculation of Candidate Profile Completeness (0 - 100%)
 */
function calculateProfileCompleteness(profile) {
  if (!profile) {
    return {
      score: 0,
      breakdown: [],
      missingItems: [],
      completedCount: 0,
      totalItemsCount: 0
    };
  }

  const items = [
    {
      key: 'account',
      label: 'Account Registration',
      points: 5,
      completed: Boolean(profile.userId || profile.user?.email),
      tip: 'Account created with email & name',
      route: '/candidate/profile'
    },
    {
      key: 'phone',
      label: 'Contact Phone Number',
      points: 5,
      completed: Boolean(profile.phone && profile.phone.trim().length >= 6),
      tip: 'Add your primary mobile or contact number',
      route: '/candidate/profile'
    },
    {
      key: 'city',
      label: 'Current Location / City',
      points: 5,
      completed: Boolean(profile.city && profile.city.trim().length > 0),
      tip: 'Specify your base city / location',
      route: '/candidate/profile'
    },
    {
      key: 'designation',
      label: 'Current Designation / Title',
      points: 5,
      completed: Boolean(profile.designation && profile.designation.trim().length > 0),
      tip: 'Enter your current job title or role',
      route: '/candidate/profile'
    },
    {
      key: 'category',
      label: 'Professional Category',
      points: 5,
      completed: Boolean(profile.professionalCategory && profile.professionalCategory.trim().length > 0),
      tip: 'Select professional category (Insolvency Professional, CA, CS, Lawyer, etc.)',
      route: '/candidate/profile'
    },
    {
      key: 'bio',
      label: 'Professional Bio & Summary',
      points: 5,
      completed: Boolean(profile.bio && profile.bio.trim().length >= 10),
      tip: 'Write a brief professional summary about your practice',
      route: '/candidate/profile'
    },
    {
      key: 'experienceYears',
      label: 'Experience & Notice Period',
      points: 5,
      completed: Boolean((profile.experience !== null && profile.experience !== undefined) || (profile.noticePeriod && profile.noticePeriod.trim().length > 0)),
      tip: 'Provide total experience years or notice period',
      route: '/candidate/profile'
    },
    {
      key: 'photo',
      label: 'Profile Photo',
      points: 10,
      completed: Boolean(profile.profilePhoto && profile.profilePhoto.trim().length > 0),
      tip: 'Upload a professional profile photo',
      route: '/candidate/profile'
    },
    {
      key: 'resume',
      label: 'Resume / CV Document',
      points: 20,
      completed: Boolean(profile.resumeUrl && profile.resumeUrl.trim().length > 0),
      tip: 'Upload your latest CV or document',
      route: '/candidate/resume'
    },
    {
      key: 'skills',
      label: 'Domain Skills',
      points: 15,
      completed: (profile.skills?.length || 0) >= 1,
      earnedPoints: (profile.skills?.length || 0) >= 3 ? 15 : (profile.skills?.length || 0) >= 1 ? 10 : 0,
      tip: (profile.skills?.length || 0) >= 3 ? 'Skills portfolio complete' : 'Add at least 3 domain skills (CIRP, IBC, Liquidation, etc.)',
      route: '/candidate/profile'
    },
    {
      key: 'experienceHistory',
      label: 'Work Experience History',
      points: 10,
      completed: (profile.experiences?.length || 0) >= 1,
      tip: 'Add at least 1 work experience record',
      route: '/candidate/profile'
    },
    {
      key: 'education',
      label: 'Education & Qualifications',
      points: 5,
      completed: (profile.educations?.length || 0) >= 1,
      tip: 'Add your highest educational degree / qualifications',
      route: '/candidate/profile'
    },
    {
      key: 'certification',
      label: 'Professional Certifications',
      points: 5,
      completed: (profile.certifications?.length || 0) >= 1,
      tip: 'Add IBBI, ICAI, ICSI, Bar Council or relevant registrations',
      route: '/candidate/profile'
    }
  ];

  let totalScore = 0;
  items.forEach(item => {
    const itemEarned = item.earnedPoints !== undefined 
      ? item.earnedPoints 
      : (item.completed ? item.points : 0);
    item.earned = itemEarned;
    totalScore += itemEarned;
  });

  const finalScore = Math.min(100, Math.max(0, totalScore));
  const missingItems = items
    .filter(item => item.earned < item.points)
    .sort((a, b) => (b.points - b.earned) - (a.points - a.earned));

  return {
    score: finalScore,
    breakdown: items,
    missingItems,
    completedCount: items.filter(item => item.earned === item.points).length,
    totalItemsCount: items.length
  };
}

// 1. Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  try {
    const candidateId = req.user.id;

    // Applications count & status breakdown
    const totalApplications = await prisma.application.count({
      where: { candidateId }
    });

    const shortlistedCount = await prisma.application.count({
      where: { candidateId, status: 'SHORTLISTED' }
    });

    const interviewsCount = await prisma.interview.count({
      where: { candidateId, status: 'SCHEDULED' }
    });

    const savedJobsCount = await prisma.savedJob.count({
      where: { userId: candidateId }
    });

    // Recent applications
    const recentApplications = await prisma.application.findMany({
      where: { candidateId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            employer: { select: { id: true, name: true, logoUrl: true, type: true, location: true } }
          }
        },
        interviews: {
          orderBy: { interviewDate: 'asc' },
          take: 1
        }
      }
    });

    // Upcoming interviews
    const upcomingInterviews = await prisma.interview.findMany({
      where: {
        candidateId,
        interviewDate: { gte: new Date() },
        status: 'SCHEDULED'
      },
      take: 5,
      orderBy: { interviewDate: 'asc' },
      include: {
        job: { select: { id: true, title: true } },
        employer: { select: { id: true, name: true, logoUrl: true, location: true } }
      }
    });

    // Recommended / Open Jobs (excluding jobs the candidate has already applied to)
    const recommendedJobs = await prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        applications: {
          none: { candidateId }
        }
      },
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: {
        employer: { select: { id: true, name: true, logoUrl: true, type: true, location: true } },
        skills: { include: { skill: true } },
        savedBy: { where: { userId: candidateId } },
        applications: { where: { candidateId } }
      }
    });

    // Profile completeness score & stats calculation
    const profile = await getOrCreateCandidateProfile(candidateId);
    const completeness = calculateProfileCompleteness(profile);

    res.json({
      success: true,
      data: {
        stats: {
          applications: totalApplications,
          shortlisted: shortlistedCount,
          interviews: interviewsCount,
          savedJobs: savedJobsCount,
          profileCompleteness: completeness.score
        },
        completenessDetails: completeness,
        recentApplications,
        upcomingInterviews,
        recommendedJobs,
        profile: {
          ...profile,
          completeness
        }
      }
    });
  } catch (error) {
    console.error('Error fetching candidate dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Candidate Profile (Full)
exports.getProfile = async (req, res) => {
  try {
    const profile = await getOrCreateCandidateProfile(req.user.id);
    const completeness = calculateProfileCompleteness(profile);
    res.json({ 
      success: true, 
      data: {
        ...profile,
        completeness
      } 
    });
  } catch (error) {
    console.error('Error fetching candidate profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Basic & Professional Details
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      city,
      designation,
      professionalCategory,
      experience,
      currentSalary,
      expectedSalary,
      noticePeriod,
      profilePhoto,
      bio,
      visibility
    } = req.body;

    // Update User name if changed
    if (name) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { name }
      });
    }

    const updatedProfile = await prisma.candidateProfile.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        phone,
        city,
        designation,
        professionalCategory,
        experience: experience ? parseInt(experience) : null,
        currentSalary: currentSalary ? parseFloat(currentSalary) : null,
        expectedSalary: expectedSalary ? parseFloat(expectedSalary) : null,
        noticePeriod,
        profilePhoto,
        bio,
        visibility: visibility || 'PUBLIC'
      },
      update: {
        phone,
        city,
        designation,
        professionalCategory,
        experience: experience !== undefined ? (experience ? parseInt(experience) : null) : undefined,
        currentSalary: currentSalary !== undefined ? (currentSalary ? parseFloat(currentSalary) : null) : undefined,
        expectedSalary: expectedSalary !== undefined ? (expectedSalary ? parseFloat(expectedSalary) : null) : undefined,
        noticePeriod,
        profilePhoto,
        bio,
        visibility
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        educations: true,
        experiences: true,
        skills: { include: { skill: true } },
        certifications: true
      }
    });

    res.json({ success: true, message: 'Profile updated successfully', data: updatedProfile });
  } catch (error) {
    console.error('Error updating candidate profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Education CRUD
exports.addEducation = async (req, res) => {
  try {
    const profile = await getOrCreateCandidateProfile(req.user.id);
    const { qualification, degree, specialisation, institution, startYear, completionYear } = req.body;

    if (!qualification || !degree || !institution) {
      return res.status(400).json({ success: false, message: 'Qualification, degree and institution are required.' });
    }

    const education = await prisma.education.create({
      data: {
        candidateProfileId: profile.id,
        qualification,
        degree,
        specialisation,
        institution,
        startYear: startYear ? parseInt(startYear) : null,
        completionYear: completionYear ? parseInt(completionYear) : null,
      }
    });

    res.json({ success: true, message: 'Education added successfully', data: education });
  } catch (error) {
    console.error('Error adding education:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEducation = async (req, res) => {
  try {
    const eduId = parseInt(req.params.id);
    const { qualification, degree, specialisation, institution, startYear, completionYear } = req.body;

    const education = await prisma.education.update({
      where: { id: eduId },
      data: {
        qualification,
        degree,
        specialisation,
        institution,
        startYear: startYear ? parseInt(startYear) : null,
        completionYear: completionYear ? parseInt(completionYear) : null,
      }
    });

    res.json({ success: true, message: 'Education updated successfully', data: education });
  } catch (error) {
    console.error('Error updating education:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteEducation = async (req, res) => {
  try {
    const eduId = parseInt(req.params.id);
    await prisma.education.delete({ where: { id: eduId } });
    res.json({ success: true, message: 'Education deleted successfully' });
  } catch (error) {
    console.error('Error deleting education:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Experience CRUD
exports.addExperience = async (req, res) => {
  try {
    const profile = await getOrCreateCandidateProfile(req.user.id);
    const { organisation, designation, startDate, endDate, isCurrent, description } = req.body;

    if (!organisation || !designation) {
      return res.status(400).json({ success: false, message: 'Organisation and designation are required.' });
    }

    const experience = await prisma.experience.create({
      data: {
        candidateProfileId: profile.id,
        organisation,
        designation,
        startDate: startDate ? new Date(startDate) : null,
        endDate: isCurrent ? null : (endDate ? new Date(endDate) : null),
        isCurrent: Boolean(isCurrent),
        description,
      }
    });

    res.json({ success: true, message: 'Experience added successfully', data: experience });
  } catch (error) {
    console.error('Error adding experience:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateExperience = async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    const { organisation, designation, startDate, endDate, isCurrent, description } = req.body;

    const experience = await prisma.experience.update({
      where: { id: expId },
      data: {
        organisation,
        designation,
        startDate: startDate ? new Date(startDate) : null,
        endDate: isCurrent ? null : (endDate ? new Date(endDate) : null),
        isCurrent: Boolean(isCurrent),
        description,
      }
    });

    res.json({ success: true, message: 'Experience updated successfully', data: experience });
  } catch (error) {
    console.error('Error updating experience:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteExperience = async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    await prisma.experience.delete({ where: { id: expId } });
    res.json({ success: true, message: 'Experience deleted successfully' });
  } catch (error) {
    console.error('Error deleting experience:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Skills Management
exports.updateSkills = async (req, res) => {
  try {
    const profile = await getOrCreateCandidateProfile(req.user.id);
    const { skills } = req.body; // Array of strings, e.g. ['Insolvency', 'CIRP', 'NCLT']

    if (!Array.isArray(skills)) {
      return res.status(400).json({ success: false, message: 'Skills must be an array of strings' });
    }

    // Delete existing candidate skills
    await prisma.candidateSkill.deleteMany({
      where: { candidateProfileId: profile.id }
    });

    // Ensure skill records exist in master Skill table, then link
    for (const skillName of skills) {
      const trimmedName = skillName.trim();
      if (!trimmedName) continue;

      const skillRecord = await prisma.skill.upsert({
        where: { name: trimmedName },
        create: { name: trimmedName },
        update: {}
      });

      await prisma.candidateSkill.create({
        data: {
          candidateProfileId: profile.id,
          skillId: skillRecord.id
        }
      });
    }

    const updatedProfile = await getOrCreateCandidateProfile(req.user.id);
    res.json({ success: true, message: 'Skills updated successfully', data: updatedProfile.skills });
  } catch (error) {
    console.error('Error updating skills:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Certifications & Registrations CRUD
exports.addCertification = async (req, res) => {
  try {
    const profile = await getOrCreateCandidateProfile(req.user.id);
    const { name, issuingOrg, regNumber, issueDate, expiryDate, documentUrl } = req.body;

    if (!name || !issuingOrg) {
      return res.status(400).json({ success: false, message: 'Certification name and issuing organisation are required.' });
    }

    const cert = await prisma.certification.create({
      data: {
        candidateProfileId: profile.id,
        name,
        issuingOrg,
        regNumber,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        documentUrl
      }
    });

    res.json({ success: true, message: 'Certification added successfully', data: cert });
  } catch (error) {
    console.error('Error adding certification:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCertification = async (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    const { name, issuingOrg, regNumber, issueDate, expiryDate, documentUrl } = req.body;

    const cert = await prisma.certification.update({
      where: { id: certId },
      data: {
        name,
        issuingOrg,
        regNumber,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        documentUrl
      }
    });

    res.json({ success: true, message: 'Certification updated successfully', data: cert });
  } catch (error) {
    console.error('Error updating certification:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCertification = async (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    await prisma.certification.delete({ where: { id: certId } });
    res.json({ success: true, message: 'Certification deleted successfully' });
  } catch (error) {
    console.error('Error deleting certification:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Resume Management
exports.uploadResume = async (req, res) => {
  try {
    const { resumeUrl } = req.body;
    if (!resumeUrl) {
      return res.status(400).json({ success: false, message: 'Resume URL / file reference is required' });
    }

    const profile = await prisma.candidateProfile.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, resumeUrl },
      update: { resumeUrl }
    });

    res.json({ success: true, message: 'Resume uploaded successfully', data: { resumeUrl: profile.resumeUrl } });
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteResume = async (req, res) => {
  try {
    await prisma.candidateProfile.update({
      where: { userId: req.user.id },
      data: { resumeUrl: null }
    });
    res.json({ success: true, message: 'Resume removed successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Applications Management
exports.getApplications = async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = { candidateId: req.user.id };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { job: { title: { contains: search, mode: 'insensitive' } } },
        { job: { employer: { name: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    const applications = await prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            employer: { select: { id: true, name: true, logoUrl: true, type: true, location: true, website: true } }
          }
        },
        interviews: {
          orderBy: { interviewDate: 'desc' }
        }
      }
    });

    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Error fetching candidate applications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.applyForJob = async (req, res) => {
  try {
    const { jobId, coverNote } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }

    const existing = await prisma.application.findFirst({
      where: { jobId: parseInt(jobId), candidateId: req.user.id }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already applied for this position' });
    }

    const application = await prisma.application.create({
      data: {
        jobId: parseInt(jobId),
        candidateId: req.user.id,
        status: 'APPLIED',
        coverNote
      },
      include: {
        job: {
          include: { employer: { select: { name: true } } }
        }
      }
    });

    res.json({ success: true, message: 'Application submitted successfully!', data: application });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.withdrawApplication = async (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const existing = await prisma.application.findFirst({
      where: { id: appId, candidateId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const updated = await prisma.application.update({
      where: { id: appId },
      data: { status: 'WITHDRAWN' }
    });

    res.json({ success: true, message: 'Application withdrawn successfully', data: updated });
  } catch (error) {
    console.error('Error withdrawing application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Saved Jobs
exports.getSavedJobs = async (req, res) => {
  try {
    const savedJobs = await prisma.savedJob.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            employer: { select: { id: true, name: true, logoUrl: true, type: true, location: true } },
            applications: { where: { candidateId: req.user.id } },
            skills: { include: { skill: true } }
          }
        }
      }
    });

    res.json({ success: true, data: savedJobs });
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleSaveJob = async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const userId = req.user.id;

    const existing = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: { userId, jobId }
      }
    });

    if (existing) {
      await prisma.savedJob.delete({
        where: { id: existing.id }
      });
      return res.json({ success: true, isSaved: false, message: 'Job removed from saved list' });
    } else {
      const saved = await prisma.savedJob.create({
        data: { userId, jobId }
      });
      return res.json({ success: true, isSaved: true, message: 'Job saved successfully', data: saved });
    }
  } catch (error) {
    console.error('Error saving/unsaving job:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Candidate Interviews
exports.getInterviews = async (req, res) => {
  try {
    const interviews = await prisma.interview.findMany({
      where: { candidateId: req.user.id },
      orderBy: { interviewDate: 'asc' },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            employer: { select: { id: true, name: true, logoUrl: true, location: true } }
          }
        },
        employer: { select: { id: true, name: true, logoUrl: true, location: true } },
        application: { select: { id: true, status: true } }
      }
    });

    res.json({ success: true, data: interviews });
  } catch (error) {
    console.error('Error fetching candidate interviews:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 11. Candidate Settings & Account
exports.getSettings = async (req, res) => {
  try {
    const profile = await getOrCreateCandidateProfile(req.user.id);
    const subscriber = await prisma.stayUpdatedSubscriber.findFirst({
      where: {
        OR: [
          { userId: req.user.id },
          { email: profile.user.email.toLowerCase() }
        ]
      }
    });

    const isStayUpdated = Boolean(profile.stayUpdated || profile.user.stayUpdated || subscriber);

    res.json({
      success: true,
      data: {
        visibility: profile.visibility || 'PUBLIC',
        jobAlerts: profile.jobAlerts !== undefined ? profile.jobAlerts : true,
        applicationUpdates: profile.applicationUpdates !== undefined ? profile.applicationUpdates : true,
        interviewReminders: profile.interviewReminders !== undefined ? profile.interviewReminders : true,
        stayUpdated: isStayUpdated,
        user: {
          id: profile.user.id,
          name: profile.user.name,
          email: profile.user.email,
          stayUpdated: isStayUpdated
        }
      }
    });
  } catch (error) {
    console.error('Error fetching candidate settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { visibility, jobAlerts, applicationUpdates, interviewReminders, stayUpdated, password, currentPassword } = req.body;

    const profileData = {};
    if (visibility !== undefined) profileData.visibility = visibility;
    if (jobAlerts !== undefined) profileData.jobAlerts = Boolean(jobAlerts);
    if (applicationUpdates !== undefined) profileData.applicationUpdates = Boolean(applicationUpdates);
    if (interviewReminders !== undefined) profileData.interviewReminders = Boolean(interviewReminders);
    if (stayUpdated !== undefined) profileData.stayUpdated = Boolean(stayUpdated);

    if (Object.keys(profileData).length > 0) {
      await prisma.candidateProfile.upsert({
        where: { userId: req.user.id },
        create: { userId: req.user.id, ...profileData },
        update: profileData
      });
    }

    if (stayUpdated !== undefined) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { stayUpdated: Boolean(stayUpdated) }
      });

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (stayUpdated && user) {
        await prisma.stayUpdatedSubscriber.upsert({
          where: { email: user.email.toLowerCase() },
          create: { email: user.email.toLowerCase(), userId: user.id },
          update: { userId: user.id }
        });
      } else if (!stayUpdated && user) {
        await prisma.stayUpdatedSubscriber.deleteMany({
          where: {
            OR: [
              { userId: user.id },
              { email: user.email.toLowerCase() }
            ]
          }
        });
      }
    }

    if (password) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (currentPassword) {
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword }
      });
    }

    const updatedProfile = await getOrCreateCandidateProfile(req.user.id);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        visibility: updatedProfile.visibility || 'PUBLIC',
        jobAlerts: updatedProfile.jobAlerts !== undefined ? updatedProfile.jobAlerts : true,
        applicationUpdates: updatedProfile.applicationUpdates !== undefined ? updatedProfile.applicationUpdates : true,
        interviewReminders: updatedProfile.interviewReminders !== undefined ? updatedProfile.interviewReminders : true,
        stayUpdated: updatedProfile.stayUpdated !== undefined ? updatedProfile.stayUpdated : false
      }
    });
  } catch (error) {
    console.error('Error updating candidate settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.calculateProfileCompleteness = calculateProfileCompleteness;

