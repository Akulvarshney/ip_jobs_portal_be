const prisma = require('../prisma');

// Dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalCandidates = await prisma.user.count({ where: { role: 'CANDIDATE' } });
    const totalEmployers = await prisma.user.count({ where: { role: 'EMPLOYER' } });
    const totalAdminUsers = await prisma.user.count({ where: { role: 'ADMIN' } });
    const activeJobs = await prisma.job.count({ where: { status: 'ACTIVE' } });
    const pausedJobs = await prisma.job.count({ where: { status: 'PAUSED' } });
    const closedJobs = await prisma.job.count({ where: { status: 'CLOSED' } });
    const totalApplications = await prisma.application.count();
    const totalReports = await prisma.report.count();
    const openReports = await prisma.report.count({ where: { status: 'OPEN' } });
    const pendingEmployers = await prisma.employer.count({ where: { status: 'PENDING' } });
    const suspendedUsers = await prisma.user.count({ where: { status: 'SUSPENDED' } });

    // Recent data feeds for dashboard widgets
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    const recentEmployers = await prisma.employer.findMany({
      take: 5,
      orderBy: { id: 'desc' },
      include: {
        _count: { select: { jobs: true, members: true } },
      },
    });

    const recentJobs = await prisma.job.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        employer: { select: { id: true, name: true, type: true } },
        _count: { select: { applications: true } },
      },
    });

    const recentApplications = await prisma.application.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        job: { select: { id: true, title: true, employer: { select: { name: true } } } },
        candidate: { select: { id: true, name: true, email: true } },
      },
    });

    const recentReports = await prisma.report.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        totalCandidates,
        totalEmployers,
        totalAdminUsers,
        activeJobs,
        pausedJobs,
        closedJobs,
        totalApplications,
        totalReports,
        openReports,
        pendingEmployers,
        suspendedUsers,
        recentUsers,
        recentEmployers,
        recentJobs,
        recentApplications,
        recentReports,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Server error fetching stats' });
  }
};

// Users management
exports.getUsers = async (req, res) => {
  try {
    const { search, role, status } = req.query;

    const whereClause = {};
    if (role && role !== 'ALL') {
      whereClause.role = role;
    }
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        candidateProfile: {
          select: {
            id: true,
            phone: true,
            city: true,
            designation: true,
            experience: true,
            currentSalary: true,
            expectedSalary: true,
            noticePeriod: true,
            resumeUrl: true,
            skills: { include: { skill: true } },
            educations: true,
            experiences: true,
          },
        },
        employerMember: {
          include: {
            employer: true,
          },
        },
        _count: {
          select: {
            applications: true,
            savedJobs: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Server error fetching users' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role } = req.body;

    const updateData = {};
    if (status && ['ACTIVE', 'SUSPENDED'].includes(status)) {
      updateData.status = status;
    }
    if (role && ['CANDIDATE', 'EMPLOYER', 'ADMIN'].includes(role)) {
      updateData.role = role;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid update fields provided' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    res.json({ success: true, data: updatedUser, message: `User status updated to ${updatedUser.status}` });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Server error updating user' });
  }
};

// Employers management
exports.getEmployers = async (req, res) => {
  try {
    const { search, type, status } = req.query;

    const whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (type && type !== 'ALL') {
      whereClause.type = type;
    }
    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const employers = await prisma.employer.findMany({
      where: whereClause,
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, status: true } },
          },
        },
        jobs: {
          select: { id: true, title: true, status: true, createdAt: true },
        },
        _count: {
          select: { jobs: true, members: true },
        },
      },
      orderBy: { id: 'desc' },
    });

    res.json({ success: true, data: employers });
  } catch (error) {
    console.error('Error fetching employers:', error);
    res.status(500).json({ success: false, message: 'Server error fetching employers' });
  }
};

exports.updateEmployerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'APPROVED', 'SUSPENDED', 'PENDING'

    if (!status || !['APPROVED', 'SUSPENDED', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updatedEmployer = await prisma.employer.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        _count: {
          select: { jobs: true },
        },
      },
    });

    res.json({ success: true, data: updatedEmployer, message: `Employer status changed to ${status}` });
  } catch (error) {
    console.error('Error updating employer status:', error);
    res.status(500).json({ success: false, message: 'Server error updating employer' });
  }
};

// Jobs management
exports.getJobs = async (req, res) => {
  try {
    const { search, status, employerId } = req.query;

    const whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (employerId) {
      whereClause.employerId = Number(employerId);
    }
    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { requirements: { contains: q, mode: 'insensitive' } },
        { employer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        employer: { select: { id: true, name: true, location: true, type: true, status: true } },
        skills: {
          include: { skill: true },
        },
        _count: { select: { applications: true, savedBy: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching jobs' });
  }
};

exports.updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE', 'PAUSED', 'CLOSED', 'SUSPENDED'

    if (!status || !['ACTIVE', 'PAUSED', 'CLOSED', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid job status' });
    }

    const updatedJob = await prisma.job.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        employer: { select: { name: true } },
        _count: { select: { applications: true } },
      },
    });

    res.json({ success: true, data: updatedJob, message: `Job status changed to ${status}` });
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ success: false, message: 'Server error updating job status' });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({ where: { id: Number(id) } });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    await prisma.$transaction([
      prisma.jobSkill.deleteMany({ where: { jobId: Number(id) } }),
      prisma.application.deleteMany({ where: { jobId: Number(id) } }),
      prisma.savedJob.deleteMany({ where: { jobId: Number(id) } }),
      prisma.job.delete({ where: { id: Number(id) } }),
    ]);

    res.json({ success: true, message: 'Job listing and related applications removed successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ success: false, message: 'Server error deleting job' });
  }
};

// Applications management
exports.getApplications = async (req, res) => {
  try {
    const { search, status } = req.query;

    const whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { job: { title: { contains: q, mode: 'insensitive' } } },
        { job: { employer: { name: { contains: q, mode: 'insensitive' } } } },
        { candidate: { name: { contains: q, mode: 'insensitive' } } },
        { candidate: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        job: {
          include: {
            employer: { select: { id: true, name: true, type: true, location: true } },
            skills: { include: { skill: true } },
          },
        },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            candidateProfile: {
              select: {
                phone: true,
                city: true,
                designation: true,
                experience: true,
                expectedSalary: true,
                noticePeriod: true,
                skills: { include: { skill: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, message: 'Server error fetching applications' });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid application status' });
    }

    const updatedApp = await prisma.application.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        job: { select: { title: true } },
        candidate: { select: { name: true } },
      },
    });

    res.json({ success: true, data: updatedApp, message: `Application status updated to ${status}` });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ success: false, message: 'Server error updating application' });
  }
};

// Reports management
exports.getReports = async (req, res) => {
  try {
    const { search, status, type } = req.query;

    const whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (type && type !== 'ALL') {
      whereClause.type = type;
    }
    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { type: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const reports = await prisma.report.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: 'Server error fetching reports' });
  }
};

exports.createReport = async (req, res) => {
  try {
    const { type, description, reporterId } = req.body;

    if (!type || !description) {
      return res.status(400).json({ success: false, message: 'Type and description are required' });
    }

    const validTypes = ['Fake job', 'Fake organisation', 'Spam', 'Inappropriate content', 'Other issue'];
    const reportType = validTypes.includes(type) ? type : 'Other issue';

    const newReport = await prisma.report.create({
      data: {
        type: reportType,
        description,
        reporterId: reporterId ? Number(reporterId) : (req.user?.id || 1),
        status: 'OPEN',
      },
    });

    res.status(201).json({ success: true, data: newReport, message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ success: false, message: 'Server error creating report' });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED'

    const validStatuses = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid report status' });
    }

    const updatedReport = await prisma.report.update({
      where: { id: Number(id) },
      data: { status },
    });

    res.json({ success: true, data: updatedReport, message: `Report status set to ${status}` });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ success: false, message: 'Server error updating report' });
  }
};
