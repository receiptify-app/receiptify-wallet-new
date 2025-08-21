const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class LocalStorage {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads');
    this.ensureUploadDir();
  }
  
  async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }
  
  async saveFile(buffer, filename, contentType) {
    try {
      // Generate unique filename
      const ext = path.extname(filename) || '.bin';
      const basename = path.basename(filename, ext);
      const uniqueName = `${basename}_${crypto.randomUUID()}${ext}`;
      const filepath = path.join(this.uploadDir, uniqueName);
      
      await fs.writeFile(filepath, buffer);
      
      // Return relative URL for serving
      const url = `/uploads/${uniqueName}`;
      
      return {
        filename: uniqueName,
        filepath,
        url,
        size: buffer.length,
        contentType
      };
    } catch (error) {
      console.error('Failed to save file locally:', error);
      throw error;
    }
  }
  
  async deleteFile(filepath) {
    try {
      await fs.unlink(filepath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }
  
  async fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}

class S3Storage {
  constructor() {
    this.bucket = process.env.S3_BUCKET || 'receipts-storage';
    this.region = process.env.S3_REGION || 'us-east-1';
    this.accessKey = process.env.S3_ACCESS_KEY;
    this.secretKey = process.env.S3_SECRET_KEY;
    
    if (!this.accessKey || !this.secretKey) {
      console.warn('S3 credentials not provided, using stub implementation');
      this.isStub = true;
    }
  }
  
  async saveFile(buffer, filename, contentType) {
    if (this.isStub) {
      // Stub implementation - return mock S3 URL
      const key = `uploads/${crypto.randomUUID()}-${filename}`;
      return {
        filename,
        filepath: key,
        url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
        size: buffer.length,
        contentType
      };
    }
    
    // Real S3 implementation would go here
    throw new Error('Real S3 implementation not available in this environment');
  }
  
  async deleteFile(key) {
    if (this.isStub) {
      console.log(`[STUB] Would delete S3 object: ${key}`);
      return;
    }
    
    throw new Error('Real S3 implementation not available in this environment');
  }
  
  async fileExists(key) {
    if (this.isStub) {
      return true; // Assume exists for stub
    }
    
    throw new Error('Real S3 implementation not available in this environment');
  }
}

function createStorage() {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  
  switch (provider.toLowerCase()) {
    case 's3':
      return new S3Storage();
    case 'local':
    default:
      return new LocalStorage();
  }
}

// Singleton instance
let storageInstance = null;

function getStorage() {
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

module.exports = {
  getStorage,
  LocalStorage,
  S3Storage
};