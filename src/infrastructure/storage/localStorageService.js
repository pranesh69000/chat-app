import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Storage Abstraction for media files.
 * In local dev, stores securely in `.data/uploads/` with ₹0 cost.
 */
export class LocalStorageService {
  constructor(uploadDir = path.resolve('.data/uploads')) {
    this.uploadDir = uploadDir;
    this.metadataMap = new Map(); // fileId -> { fileId, filename, mimeType, size, ownerId, recipientId, filePath }
  }

  async init() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async saveFile({ fileId, filename, buffer, mimeType, ownerId, recipientId }) {
    await this.init();
    const filePath = path.join(this.uploadDir, `${fileId}_${path.basename(filename)}`);
    await fs.writeFile(filePath, buffer);

    const record = {
      fileId,
      filename,
      mimeType,
      size: buffer.length,
      ownerId,
      recipientId,
      filePath,
      createdAt: Date.now()
    };

    this.metadataMap.set(fileId, record);
    return record;
  }

  async getFileMetadata(fileId) {
    const record = this.metadataMap.get(fileId);
    return record ? { ...record } : null;
  }

  async getFileBuffer(fileId) {
    const meta = await this.getFileMetadata(fileId);
    if (!meta) return null;
    return fs.readFile(meta.filePath);
  }

  async clear() {
    this.metadataMap.clear();
    try {
      await fs.rm(this.uploadDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }
}

export const storageService = new LocalStorageService();
