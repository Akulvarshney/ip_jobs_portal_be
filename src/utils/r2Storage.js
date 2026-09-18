const { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

// Helper to get configuration with support for standard S3 / R2 aliases
const getR2Config = () => {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME;
  
  let endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
  if (!endpoint && process.env.R2_ACCOUNT_ID) {
    endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }

  return {
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    isConfigured: Boolean(accessKeyId && secretAccessKey && bucketName && endpoint)
  };
};

// Helper to check if Cloudflare R2 is configured in environment
const isR2Configured = () => {
  return getR2Config().isConfigured;
};

// Initialize S3 Client configured for Cloudflare R2
const getR2Client = () => {
  const config = getR2Config();
  if (!config.isConfigured) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
};

/**
 * Uploads a file buffer directly to Cloudflare R2
 * @param {Object} params
 * @param {Buffer} params.buffer - File buffer from multer
 * @param {string} params.originalName - Original file name
 * @param {string} params.mimeType - MIME type of the file
 * @param {string} [params.folder='documents'] - Target folder path (e.g., 'resumes', 'avatars', 'logos', 'documents')
 */
const uploadToR2 = async ({ buffer, originalName, mimeType, folder = 'documents' }) => {
  if (!isR2Configured()) {
    throw new Error(
      'Cloudflare R2 is not configured. Please ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are set in your .env file.'
    );
  }

  const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB hard limit
  if (buffer && buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds the 3MB limit. Please upload a file under 3MB.');
  }

  const config = getR2Config();
  const client = getR2Client();
  const bucketName = config.bucketName;

  // Sanitize filename and create unique timestamped key
  const ext = path.extname(originalName) || '';
  const baseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const key = `${folder}/${Date.now()}-${randomSuffix}-${baseName}${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await client.send(command);

  // Determine public URL:
  // If R2_PUBLIC_URL is provided (e.g. https://pub-xxx.r2.dev or https://assets.mydomain.com), use it directly.
  // Otherwise, construct direct public URL or provide internal proxy endpoint.
  let fileUrl;
  if (process.env.R2_PUBLIC_URL) {
    const baseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '');
    fileUrl = `${baseUrl}/${key}`;
  } else {
    fileUrl = `/api/upload/file/${key}`;
  }

  return {
    url: fileUrl,
    key,
    bucket: bucketName,
    size: buffer.length,
    mimeType,
    originalName,
  };
};

/**
 * Deletes a file from Cloudflare R2 by key or full URL
 * @param {string} fileKeyOrUrl - Key or URL of the file to delete
 */
const deleteFromR2 = async (fileKeyOrUrl) => {
  if (!fileKeyOrUrl || !isR2Configured()) return false;

  try {
    let key = fileKeyOrUrl;
    // Extract key if a full URL was provided
    if (fileKeyOrUrl.startsWith('http://') || fileKeyOrUrl.startsWith('https://')) {
      const parsed = new URL(fileKeyOrUrl);
      key = parsed.pathname.replace(/^\//, '');
    } else if (fileKeyOrUrl.startsWith('/api/upload/file/')) {
      key = fileKeyOrUrl.replace('/api/upload/file/', '');
    }

    const config = getR2Config();
    const client = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file from R2:', error);
    return false;
  }
};

/**
 * Generates a presigned download URL for private files in R2
 * @param {string} key - Object key in bucket
 * @param {number} [expiresIn=3600] - Expiration in seconds
 */
const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
  if (!isR2Configured()) return null;

  const config = getR2Config();
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn });
};

/**
 * Gets the raw object stream from R2
 * @param {string} key - Object key in bucket
 */
const getR2ObjectStream = async (key) => {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const config = getR2Config();
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return await client.send(command);
};

module.exports = {
  isR2Configured,
  uploadToR2,
  deleteFromR2,
  getSignedDownloadUrl,
  getR2ObjectStream,
};
