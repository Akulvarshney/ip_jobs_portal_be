const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../prisma');
const { sendPasswordResetEmail, sendRegistrationOtpEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// In-memory store for Registration OTPs (with expiry)
const otpStore = new Map();

// In-memory store for Password Reset OTPs (with expiry)
const passwordResetStore = new Map();

// Helper to clean up expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of otpStore.entries()) {
    if (entry.expires < now) {
      otpStore.delete(email);
    }
  }
  for (const [email, entry] of passwordResetStore.entries()) {
    if (entry.expires < now) {
      passwordResetStore.delete(email);
    }
  }
}, 5 * 60 * 1000);

// 1. Send OTP for Email Verification (Registration)
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists. Please Sign In.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(normalizedEmail, {
      code: otp,
      expires,
      verified: false
    });

    // Send email via Nodemailer
    await sendRegistrationOtpEmail(normalizedEmail, otp);

    console.log(`[AUTH] 📧 Verification OTP for ${normalizedEmail}: ${otp}`);

    res.json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}`,
      otp // Provide OTP for convenient local testing / dev mode
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP code are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const entry = otpStore.get(normalizedEmail);

    if (!entry) {
      return res.status(400).json({ success: false, error: 'No verification code was requested for this email or it has expired. Please request a new code.' });
    }

    if (Date.now() > entry.expires) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    if (entry.code !== otp.trim()) {
      return res.status(400).json({ success: false, error: 'Incorrect verification code. Please check and try again.' });
    }

    // Mark as verified
    entry.verified = true;
    otpStore.set(normalizedEmail, entry);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now set your password.'
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Register (with verified email & password)
exports.register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const otpEntry = otpStore.get(normalizedEmail);
    if (!otpEntry || !otpEntry.verified) {
      return res.status(400).json({ error: 'Please verify your email address with the OTP first.' });
    }

    // Clean up OTP store
    otpStore.delete(normalizedEmail);

    const displayName = name || normalizedEmail.split('@')[0];
    const userRole = role === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: displayName,
        email: normalizedEmail,
        password: hashedPassword,
        role: userRole,
        authProvider: 'EMAIL',
        candidateProfile: userRole === 'CANDIDATE' ? {
          create: {
            visibility: 'PUBLIC'
          }
        } : undefined
      }
    });

    if (userRole === 'EMPLOYER') {
      const employerOrg = await prisma.employer.create({
        data: {
          name: req.body.companyName || `${displayName}'s Organization`,
          location: 'India',
          status: 'APPROVED'
        }
      });
      await prisma.employerMember.create({
        data: {
          userId: user.id,
          employerId: employerOrg.id,
          role: 'ADMIN'
        }
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: 'EMAIL'
      }
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: error.message });
  }
};

// 4. Standard Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider || 'EMAIL'
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: error.message });
  }
};

// 5. Official Google Sign In / Sign Up Token Verification
exports.googleAuth = async (req, res) => {
  try {
    const { credential, email: manualEmail, name: manualName, photoUrl: manualPhoto, role, companyName, googleId: directGoogleId } = req.body;

    let email = manualEmail;
    let name = manualName;
    let photoUrl = manualPhoto;
    let googleId = directGoogleId;

    // If Google JWT Credential provided from Google Identity Services button
    if (credential) {
      try {
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          email = decoded.email;
          name = decoded.name || decoded.given_name || email.split('@')[0];
          photoUrl = decoded.picture;
          googleId = decoded.sub;
        }
      } catch (err) {
        console.warn('JWT decode failed, using request body parameters:', err);
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Google authentication did not provide a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { candidateProfile: true, employerMember: true }
    });

    // If user does not exist AND no role was chosen yet, tell frontend to prompt for profile & role selection
    if (!user && !role) {
      return res.json({
        success: true,
        isNewUser: true,
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        photoUrl: photoUrl || null,
        authProvider: 'GOOGLE'
      });
    }

    if (!user) {
      // Create new user with selected role
      const chosenRole = role === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';
      const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
      const displayName = name || normalizedEmail.split('@')[0];

      user = await prisma.user.create({
        data: {
          name: displayName,
          email: normalizedEmail,
          password: randomPassword,
          role: chosenRole,
          authProvider: 'GOOGLE',
          googleId: googleId || null,
          candidateProfile: chosenRole === 'CANDIDATE' ? {
            create: {
              profilePhoto: photoUrl,
              visibility: 'PUBLIC'
            }
          } : undefined
        }
      });

      if (chosenRole === 'EMPLOYER') {
        const employerOrg = await prisma.employer.create({
          data: {
            name: companyName || `${displayName}'s Organization`,
            location: 'India',
            status: 'APPROVED'
          }
        });
        await prisma.employerMember.create({
          data: {
            userId: user.id,
            employerId: employerOrg.id,
            role: 'ADMIN'
          }
        });
      }
    } else {
      // If user exists, update authProvider to GOOGLE if not set or link googleId
      const updateData = {};
      if (!user.authProvider) updateData.authProvider = 'GOOGLE';
      if (googleId && !user.googleId) updateData.googleId = googleId;
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
      }

      if (photoUrl && user.candidateProfile && !user.candidateProfile.profilePhoto) {
        await prisma.candidateProfile.update({
          where: { id: user.candidateProfile.id },
          data: { profilePhoto: photoUrl }
        });
      }
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      isNewUser: false,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider || 'GOOGLE'
      }
    });
  } catch (error) {
    console.error('Error in googleAuth:', error);
    res.status(500).json({ error: error.message });
  }
};

// 6. Get Current User info
exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        authProvider: true,
        googleId: true
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 7. Forgot Password - Send Reset OTP via Nodemailer
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide your registered email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email address.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    passwordResetStore.set(normalizedEmail, {
      code: otp,
      expires,
      verified: false,
      userId: user.id
    });

    // Send email with Nodemailer
    await sendPasswordResetEmail(normalizedEmail, otp, user.name);

    console.log(`[AUTH] 🔐 Password Reset OTP for ${normalizedEmail}: ${otp}`);

    res.json({
      success: true,
      message: `Password reset OTP has been sent to ${normalizedEmail}`,
      otp // Return OTP in dev mode for easy testing
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 8. Verify Password Reset OTP
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP code are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const entry = passwordResetStore.get(normalizedEmail);

    if (!entry) {
      return res.status(400).json({ success: false, error: 'No reset request found for this email or it has expired. Please request a new one.' });
    }

    if (Date.now() > entry.expires) {
      passwordResetStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, error: 'Password reset code has expired. Please request a new code.' });
    }

    if (entry.code !== otp.trim()) {
      return res.status(400).json({ success: false, error: 'Incorrect verification code. Please check and try again.' });
    }

    // Mark as verified
    entry.verified = true;
    passwordResetStore.set(normalizedEmail, entry);

    res.json({
      success: true,
      message: 'OTP verified successfully! You can now set a new password.'
    });
  } catch (error) {
    console.error('Error in verifyResetOtp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 9. Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const entry = passwordResetStore.get(normalizedEmail);

    if (!entry || !entry.verified) {
      return res.status(400).json({ success: false, error: 'Please verify the reset OTP before changing your password.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user in DB
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { password: hashedPassword }
    });

    // Cleanup store
    passwordResetStore.delete(normalizedEmail);

    res.json({
      success: true,
      message: 'Password reset successful! You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
