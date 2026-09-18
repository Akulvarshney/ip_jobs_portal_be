const prisma = require('../prisma');

/**
 * Check if an email or logged-in user is already registered for Stay Updated
 */
exports.getStatus = async (req, res) => {
  try {
    let email = req.query.email ? req.query.email.trim().toLowerCase() : null;
    let userId = req.user?.id || null;

    if (!email && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        email = user.email.toLowerCase();
      }
    }

    if (!email) {
      return res.json({
        success: true,
        isRegistered: false,
        email: null,
      });
    }

    // Check in StayUpdatedSubscriber or User table
    const subscriber = await prisma.stayUpdatedSubscriber.findFirst({
      where: {
        OR: [
          { email },
          ...(userId ? [{ userId }] : [])
        ]
      }
    });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, stayUpdated: true, email: true }
    });

    const isRegistered = Boolean(subscriber || user?.stayUpdated);

    res.json({
      success: true,
      isRegistered,
      email,
      alreadyRegistered: isRegistered
    });
  } catch (error) {
    console.error('Error fetching stay-updated status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Subscribe / Register to Stay Updated Program
 */
exports.subscribe = async (req, res) => {
  try {
    let { email } = req.body;
    const userId = req.user?.id || null;

    if (!email && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        email = user.email;
      }
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Valid email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already registered in subscriber table
    const existingSubscriber = await prisma.stayUpdatedSubscriber.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          ...(userId ? [{ userId }] : [])
        ]
      }
    });

    // Check if user exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingSubscriber || existingUser?.stayUpdated) {
      // Ensure sync on user and profile if logged in
      if (userId || existingUser) {
        const targetUserId = userId || existingUser.id;
        await prisma.user.update({
          where: { id: targetUserId },
          data: { stayUpdated: true }
        }).catch(() => {});

        await prisma.candidateProfile.updateMany({
          where: { userId: targetUserId },
          data: { stayUpdated: true }
        }).catch(() => {});
      }

      return res.json({
        success: true,
        alreadyRegistered: true,
        isRegistered: true,
        message: "You are already registered in the Stay Tuned program."
      });
    }

    // Create subscriber record
    const targetUserId = userId || (existingUser ? existingUser.id : null);
    await prisma.stayUpdatedSubscriber.create({
      data: {
        email: normalizedEmail,
        userId: targetUserId
      }
    });

    // Mark user and candidate profile stayUpdated = true if user exists
    if (targetUserId) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { stayUpdated: true }
      }).catch(() => {});

      await prisma.candidateProfile.updateMany({
        where: { userId: targetUserId },
        data: { stayUpdated: true }
      }).catch(() => {});
    }

    res.json({
      success: true,
      alreadyRegistered: false,
      isRegistered: true,
      message: "You have been successfully registered for the Stay Tuned program!"
    });
  } catch (error) {
    console.error('Error subscribing to stay-updated:', error);
    if (error.code === 'P2002') {
      return res.json({
        success: true,
        alreadyRegistered: true,
        isRegistered: true,
        message: "You are already registered in the Stay Tuned program."
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to register for Stay Updated' });
  }
};

/**
 * Unsubscribe from Stay Updated
 */
exports.unsubscribe = async (req, res) => {
  try {
    let { email } = req.body;
    const userId = req.user?.id || null;

    if (!email && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        email = user.email;
      }
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    await prisma.stayUpdatedSubscriber.deleteMany({
      where: {
        OR: [
          { email: normalizedEmail },
          ...(userId ? [{ userId }] : [])
        ]
      }
    });

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { stayUpdated: false }
      }).catch(() => {});

      await prisma.candidateProfile.updateMany({
        where: { userId },
        data: { stayUpdated: false }
      }).catch(() => {});
    }

    res.json({
      success: true,
      isRegistered: false,
      alreadyRegistered: false,
      message: "You have unsubscribed from the Stay Tuned program."
    });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
