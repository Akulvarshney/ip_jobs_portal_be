const prisma = require('../prisma');

exports.getAllJobs = async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      include: { 
        employer: { select: { id: true, name: true, location: true, type: true } },
        skills: { include: { skill: true } },
        _count: { select: { applications: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching all jobs:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        employer: true,
        skills: { include: { skill: true } },
        applications: {
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                email: true,
                candidateProfile: {
                  include: {
                    skills: { include: { skill: true } },
                    educations: true,
                    experiences: true,
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { applications: true, savedBy: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job mandate not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job by ID:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCompanyById = async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const company = await prisma.employer.findUnique({
      where: { id: companyId },
      include: {
        jobs: {
          where: { status: 'ACTIVE' },
          include: {
            skills: { include: { skill: true } },
            _count: { select: { applications: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        members: {
          select: {
            id: true,
            role: true,
            user: { select: { name: true, email: true } }
          }
        },
        _count: {
          select: { jobs: true, members: true }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: 'Organisation not found' });
    }

    res.json({ success: true, data: company });
  } catch (error) {
    console.error('Error fetching company by ID:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmployerJobs = async (req, res) => {
  try {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find the employer membership for this user, if any
    const member = await prisma.employerMember.findUnique({
      where: { userId: req.user.id }
    });

    let whereClause = {};
    if (member) {
      whereClause = { employerId: member.employerId };
    } else {
      whereClause = {
        OR: [
          { employerId: req.user.id },
          { employer: { members: { some: { userId: req.user.id } } } }
        ]
      };
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        employer: true,
        skills: { include: { skill: true } },
        applications: {
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                email: true,
                candidateProfile: {
                  include: {
                    skills: { include: { skill: true } },
                    educations: true,
                    experiences: true,
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { applications: true } }
      }
    });
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching employer jobs:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createJob = async (req, res) => {
  try {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { title, description, requirements, skillIds } = req.body;
    if (!title || !description || !requirements) {
      return res.status(400).json({ error: 'Title, description and requirements are required' });
    }

    // Determine employerId
    let employerId = req.user.id;
    const member = await prisma.employerMember.findUnique({
      where: { userId: req.user.id }
    });
    if (member) {
      employerId = member.employerId;
    } else {
      // Find or create default employer entity for this user
      let employer = await prisma.employer.findFirst({
        where: { members: { some: { userId: req.user.id } } }
      });
      if (!employer) {
        employer = await prisma.employer.create({
          data: {
            name: `${req.user.name || 'Entity'} Mandates`,
            status: 'APPROVED',
            members: {
              create: { userId: req.user.id, role: 'ADMIN' }
            }
          }
        });
      }
      employerId = employer.id;
    }

    const job = await prisma.job.create({
      data: {
        title,
        description,
        requirements,
        employerId,
        status: 'ACTIVE'
      }
    });

    if (Array.isArray(skillIds) && skillIds.length > 0) {
      for (const sId of skillIds) {
        await prisma.jobSkill.create({
          data: { jobId: job.id, skillId: Number(sId) }
        });
      }
    }

    const createdJob = await prisma.job.findUnique({
      where: { id: job.id },
      include: {
        employer: true,
        skills: { include: { skill: true } },
        applications: true
      }
    });

    res.json(createdJob);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: error.message });
  }
};
