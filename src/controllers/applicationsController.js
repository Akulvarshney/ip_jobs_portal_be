const prisma = require('../prisma');

exports.applyJob = async (req, res) => {
  try {
    if (req.user.role !== 'CANDIDATE') {
      return res.status(403).json({ error: 'Only candidates can apply to mandates' });
    }
    const { jobId, coverNote } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Check if already applied
    const existing = await prisma.application.findFirst({
      where: { jobId: Number(jobId), candidateId: req.user.id }
    });
    if (existing) {
      return res.status(400).json({ error: 'You have already applied for this mandate' });
    }
    
    const application = await prisma.application.create({
      data: { 
        jobId: Number(jobId), 
        candidateId: req.user.id, 
        status: 'APPLIED',
        coverNote 
      },
      include: {
        job: { select: { title: true, employer: { select: { name: true } } } }
      }
    });
    res.json(application);
  } catch (error) {
    console.error('Error applying for job:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getJobApplications = async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    
    const applications = await prisma.application.findMany({
      where: { jobId },
      include: { 
        candidate: { 
          select: { 
            id: true, 
            name: true, 
            email: true,
            candidateProfile: {
              include: {
                skills: { include: { skill: true } },
                educations: { orderBy: { completionYear: 'desc' } },
                experiences: { orderBy: { startDate: 'desc' } },
                certifications: { orderBy: { id: 'desc' } }
              }
            }
          } 
        },
        job: {
          select: { id: true, title: true, employer: { select: { name: true } } }
        },
        interviews: {
          orderBy: { interviewDate: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(applications);
  } catch (error) {
    console.error('Error fetching job applications:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getEmployerApplications = async (req, res) => {
  try {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { status, jobId, search } = req.query;

    const member = await prisma.employerMember.findUnique({
      where: { userId: req.user.id }
    });

    let employerWhere = {};
    if (member) {
      employerWhere = { employerId: member.employerId };
    } else {
      employerWhere = {
        OR: [
          { employerId: req.user.id },
          { employer: { members: { some: { userId: req.user.id } } } }
        ]
      };
    }

    const where = {
      job: employerWhere
    };

    if (jobId && jobId !== 'ALL') {
      where.jobId = parseInt(jobId);
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { candidate: { name: { contains: search, mode: 'insensitive' } } },
        { candidate: { email: { contains: search, mode: 'insensitive' } } },
        { job: { title: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const applications = await prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            candidateProfile: {
              include: {
                skills: { include: { skill: true } },
                educations: { orderBy: { completionYear: 'desc' } },
                experiences: { orderBy: { startDate: 'desc' } },
                certifications: { orderBy: { id: 'desc' } }
              }
            }
          }
        },
        job: {
          select: { id: true, title: true, employer: { select: { id: true, name: true, type: true } } }
        },
        interviews: {
          orderBy: { interviewDate: 'desc' }
        }
      }
    });

    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Error fetching employer applications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const { status } = req.body;

    const validStatuses = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid application status' });
    }

    const updatedApp = await prisma.application.update({
      where: { id: appId },
      data: { status },
      include: {
        job: { select: { title: true } },
        candidate: { select: { name: true, email: true } }
      }
    });
    res.json({ success: true, message: `Status updated to ${status}`, data: updatedApp });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.scheduleInterview = async (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const { interviewDate, interviewTime, interviewType, meetingLink, interviewer, notes } = req.body;

    const app = await prisma.application.findUnique({
      where: { id: appId },
      include: { job: true }
    });

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const interview = await prisma.interview.create({
      data: {
        applicationId: app.id,
        candidateId: app.candidateId,
        employerId: app.job.employerId,
        jobId: app.jobId,
        interviewDate: new Date(interviewDate),
        interviewTime: interviewTime || '11:00 AM',
        interviewType: interviewType || 'ONLINE',
        meetingLink,
        interviewer,
        notes,
        status: 'SCHEDULED'
      }
    });

    await prisma.application.update({
      where: { id: appId },
      data: { status: 'INTERVIEW' }
    });

    res.json({ success: true, message: 'Interview scheduled successfully', data: interview });
  } catch (error) {
    console.error('Error scheduling interview:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendInvite = async (req, res) => {
  try {
    const appId = parseInt(req.params.id);

    const updatedApp = await prisma.application.update({
      where: { id: appId },
      data: { status: 'INTERVIEW' },
      include: {
        job: { select: { title: true } },
        candidate: { select: { name: true, email: true } }
      }
    });
    res.json(updatedApp);
  } catch (error) {
    console.error('Error sending interview invite:', error);
    res.status(500).json({ error: error.message });
  }
};
