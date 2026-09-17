const prisma = require('../prisma');

// Helper to get or create employer record for logged-in user
async function getOrCreateEmployer(userId, userName) {
  let member = await prisma.employerMember.findUnique({
    where: { userId },
    include: { employer: { include: { _count: { select: { jobs: true, members: true } } } } }
  });

  if (member && member.employer) {
    return member.employer;
  }

  // Check if employer exists where this user is member
  let employer = await prisma.employer.findFirst({
    where: { members: { some: { userId } } },
    include: { _count: { select: { jobs: true, members: true } } }
  });

  if (!employer) {
    employer = await prisma.employer.create({
      data: {
        name: userName ? `${userName}'s Organisation` : 'Insolvency Entity',
        type: 'IPE',
        status: 'APPROVED',
        members: {
          create: { userId, role: 'ADMIN' }
        }
      },
      include: { _count: { select: { jobs: true, members: true } } }
    });
  }

  return employer;
}

exports.getOrganisation = async (req, res) => {
  try {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied. Employer role required.' });
    }

    const employer = await getOrCreateEmployer(req.user.id, req.user.name);
    res.json({ success: true, data: employer });
  } catch (error) {
    console.error('Error fetching organisation profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrganisation = async (req, res) => {
  try {
    if (req.user.role !== 'EMPLOYER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied. Employer role required.' });
    }

    const { name, logoUrl, type, description, website, location } = req.body;

    const currentEmployer = await getOrCreateEmployer(req.user.id, req.user.name);

    const updated = await prisma.employer.update({
      where: { id: currentEmployer.id },
      data: {
        name: name || currentEmployer.name,
        logoUrl,
        type,
        description,
        website,
        location
      },
      include: { _count: { select: { jobs: true, members: true } } }
    });

    res.json({ success: true, message: 'Organisation profile updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating organisation profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
