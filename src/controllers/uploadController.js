const prisma = require('../prisma');
const { 
  isR2Configured, 
  uploadToR2, 
  deleteFromR2, 
  getSignedDownloadUrl, 
  getR2ObjectStream 
} = require('../utils/r2Storage');

// 3 MB Hard Limit in bytes
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

/**
 * Check Cloudflare R2 Configuration Status
 */
exports.getStatus = async (req, res) => {
  const configured = isR2Configured();
  res.json({
    success: true,
    data: {
      configured,
      bucket: configured ? process.env.R2_BUCKET_NAME : null,
      publicUrlConfigured: Boolean(process.env.R2_PUBLIC_URL),
      maxFileSizeMb: 3,
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES
    }
  });
};

/**
 * Upload Candidate Resume / CV to Cloudflare R2
 */
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No resume file uploaded.' });
    }

    if (req.file.size > MAX_FILE_SIZE_BYTES || (req.file.buffer && req.file.buffer.length > MAX_FILE_SIZE_BYTES)) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the 3MB limit. Please upload a resume under 3MB.'
      });
    }

    if (!isR2Configured()) {
      return res.status(500).json({
        success: false,
        message: 'Cloudflare R2 is not configured. Please add R2 credentials to .env file.'
      });
    }

    const uploadResult = await uploadToR2({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: 'resumes',
    });

    // Update candidate profile with new resume URL
    const updatedProfile = await prisma.candidateProfile.upsert({
      where: { userId: req.user.id },
      create: { 
        userId: req.user.id, 
        resumeUrl: uploadResult.url 
      },
      update: { 
        resumeUrl: uploadResult.url 
      }
    });

    res.json({
      success: true,
      message: 'Resume uploaded successfully to Cloudflare R2',
      data: {
        resumeUrl: uploadResult.url,
        key: uploadResult.key,
        size: uploadResult.size,
        originalName: uploadResult.originalName,
        profile: updatedProfile,
      }
    });
  } catch (error) {
    console.error('Error uploading resume to R2:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload resume to Cloudflare R2' });
  }
};

/**
 * Upload User / Candidate Profile Avatar to Cloudflare R2
 */
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    if (req.file.size > MAX_FILE_SIZE_BYTES || (req.file.buffer && req.file.buffer.length > MAX_FILE_SIZE_BYTES)) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the 3MB limit. Please upload an image under 3MB.'
      });
    }

    if (!isR2Configured()) {
      return res.status(500).json({
        success: false,
        message: 'Cloudflare R2 is not configured. Please add R2 credentials to .env file.'
      });
    }

    const uploadResult = await uploadToR2({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: 'avatars',
    });

    // Update candidate profile photo if user is a candidate
    await prisma.candidateProfile.upsert({
      where: { userId: req.user.id },
      create: { 
        userId: req.user.id, 
        profilePhoto: uploadResult.url 
      },
      update: { 
        profilePhoto: uploadResult.url 
      }
    });

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully to Cloudflare R2',
      data: {
        profilePhoto: uploadResult.url,
        key: uploadResult.key,
      }
    });
  } catch (error) {
    console.error('Error uploading avatar to R2:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload profile photo' });
  }
};

/**
 * Upload General Document / Certification Proof to Cloudflare R2
 */
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded.' });
    }

    if (req.file.size > MAX_FILE_SIZE_BYTES || (req.file.buffer && req.file.buffer.length > MAX_FILE_SIZE_BYTES)) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the 3MB limit. Please upload a document under 3MB.'
      });
    }

    if (!isR2Configured()) {
      return res.status(500).json({
        success: false,
        message: 'Cloudflare R2 is not configured. Please add R2 credentials to .env file.'
      });
    }

    const uploadResult = await uploadToR2({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: 'documents',
    });

    res.json({
      success: true,
      message: 'Document uploaded successfully to Cloudflare R2',
      data: {
        documentUrl: uploadResult.url,
        key: uploadResult.key,
        originalName: uploadResult.originalName,
        size: uploadResult.size,
      }
    });
  } catch (error) {
    console.error('Error uploading document to R2:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload document' });
  }
};

/**
 * Upload Employer / Company Logo to Cloudflare R2
 */
exports.uploadCompanyLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No logo file uploaded.' });
    }

    if (req.file.size > MAX_FILE_SIZE_BYTES || (req.file.buffer && req.file.buffer.length > MAX_FILE_SIZE_BYTES)) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the 3MB limit. Please upload a logo under 3MB.'
      });
    }

    if (!isR2Configured()) {
      return res.status(500).json({
        success: false,
        message: 'Cloudflare R2 is not configured. Please add R2 credentials to .env file.'
      });
    }

    const uploadResult = await uploadToR2({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: 'logos',
    });

    // If user is employer member, update organisation logoUrl
    const member = await prisma.employerMember.findUnique({
      where: { userId: req.user.id },
      include: { employer: true }
    });

    if (member?.employerId) {
      await prisma.employer.update({
        where: { id: member.employerId },
        data: { logoUrl: uploadResult.url }
      });
    }

    res.json({
      success: true,
      message: 'Organisation logo uploaded successfully to Cloudflare R2',
      data: {
        logoUrl: uploadResult.url,
        key: uploadResult.key,
      }
    });
  } catch (error) {
    console.error('Error uploading logo to R2:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload logo' });
  }
};

/**
 * Proxy stream file from R2 (e.g. GET /api/upload/file/resumes/...)
 */
exports.getFileProxy = async (req, res) => {
  try {
    let fileKey = req.params.key;
    if (Array.isArray(fileKey)) {
      fileKey = fileKey.join('/');
    } else if (typeof fileKey !== 'string') {
      fileKey = req.params[0] || req.params['0'] || '';
    }
    fileKey = decodeURIComponent(fileKey).replace(/^\/+/, '');
    
    if (!fileKey) {
      return res.status(400).json({ success: false, message: 'File key is required' });
    }

    const { Body, ContentType, ContentLength } = await getR2ObjectStream(fileKey);

    if (ContentType) {
      res.setHeader('Content-Type', ContentType);
    }
    if (ContentLength) {
      res.setHeader('Content-Length', ContentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache

    Body.pipe(res);
  } catch (error) {
    console.error('Error proxying file from R2:', error);
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ success: false, message: 'File not found on Cloudflare R2' });
    }
    res.status(500).json({ success: false, message: 'Failed to retrieve file from Cloudflare R2' });
  }
};
