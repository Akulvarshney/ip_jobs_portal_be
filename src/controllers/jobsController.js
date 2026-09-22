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
    if (!jobId || isNaN(jobId)) {
      return res.status(400).json({ error: 'Valid numeric job ID is required' });
    }
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
    if (!companyId || isNaN(companyId)) {
      return res.status(400).json({ error: 'Valid numeric company ID is required' });
    }
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

    const { title, description, requirements, jobType, salaryRange, salary, experienceLevel, skillIds } = req.body;
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

    const validJobTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'MANDATE_BASED'];
    const validSalaryRanges = ['UNDER_6_LPA', 'RANGE_6_TO_12_LPA', 'RANGE_12_TO_18_LPA', 'RANGE_18_TO_25_LPA', 'RANGE_25_TO_40_LPA', 'ABOVE_40_LPA', 'NEGOTIABLE'];
    const validExpLevels = ['ENTRY_LEVEL', 'MID_LEVEL', 'SENIOR_LEVEL', 'DIRECTOR_EXECUTIVE', 'MANDATE_SPECIFIC'];

    const chosenJobType = validJobTypes.includes(jobType) ? jobType : 'FULL_TIME';
    const chosenSalaryRange = validSalaryRanges.includes(salaryRange || salary) ? (salaryRange || salary) : 'NEGOTIABLE';
    const chosenExpLevel = validExpLevels.includes(experienceLevel) ? experienceLevel : 'MID_LEVEL';

    const job = await prisma.job.create({
      data: {
        title,
        description,
        requirements,
        jobType: chosenJobType,
        salaryRange: chosenSalaryRange,
        experienceLevel: chosenExpLevel,
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

exports.updateJob = async (req, res) => {
  try {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const jobId = Number(req.params.id);
    const { title, description, requirements, jobType, salaryRange, salary, experienceLevel, status, skillIds } = req.body;

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { employer: { include: { members: true } } }
    });

    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify ownership if not admin
    if (req.user.role !== 'ADMIN') {
      const isOwner = existingJob.employerId === req.user.id ||
        existingJob.employer?.members?.some(m => m.userId === req.user.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Unauthorized to edit this job' });
      }
    }

    const validJobTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'MANDATE_BASED'];
    const validSalaryRanges = ['UNDER_6_LPA', 'RANGE_6_TO_12_LPA', 'RANGE_12_TO_18_LPA', 'RANGE_18_TO_25_LPA', 'RANGE_25_TO_40_LPA', 'ABOVE_40_LPA', 'NEGOTIABLE'];
    const validExpLevels = ['ENTRY_LEVEL', 'MID_LEVEL', 'SENIOR_LEVEL', 'DIRECTOR_EXECUTIVE', 'MANDATE_SPECIFIC'];

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (jobType !== undefined && validJobTypes.includes(jobType)) updateData.jobType = jobType;
    if ((salaryRange !== undefined || salary !== undefined)) {
      const sVal = salaryRange || salary;
      if (validSalaryRanges.includes(sVal)) updateData.salaryRange = sVal;
    }
    if (experienceLevel !== undefined && validExpLevels.includes(experienceLevel)) updateData.experienceLevel = experienceLevel;
    if (status !== undefined) updateData.status = status;

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        employer: true,
        skills: { include: { skill: true } },
        applications: true
      }
    });

    if (Array.isArray(skillIds)) {
      await prisma.jobSkill.deleteMany({ where: { jobId } });
      for (const sId of skillIds) {
        await prisma.jobSkill.create({
          data: { jobId, skillId: Number(sId) }
        });
      }
    }

    res.json(updatedJob);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: error.message });
  }
};
