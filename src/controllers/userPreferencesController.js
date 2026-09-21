const prisma = require('../prisma');

exports.updateTheme = async (req, res) => {
  const { theme } = req.body || {};
  if (theme !== 'light' && theme !== 'dark') {
    return res.status(400).json({ error: 'Theme must be light or dark' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { theme },
      select: { theme: true },
    });
    return res.json(user);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Error saving theme:', error);
    return res.status(500).json({ error: 'Unable to save theme preference' });
  }
};
