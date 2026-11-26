import crypto from 'node:crypto';
import { storageService } from '../../infrastructure/storage/storageFactory.js';
import { userRepository } from '../auth/userRepositoryFactory.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'video/mp4',
  'video/webm'
]);

const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46]
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export class MediaService {
  constructor(storage = storageService, userRepo = userRepository) {
    this.storage = storage;
    this.userRepo = userRepo;
  }

  async uploadMedia({ userId, recipientId, filename, buffer, mimeType }) {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      const error = new Error(`Unsupported media type: ${mimeType}. Images, voice audio, and video are allowed.`);
      error.statusCode = 400;
      throw error;
    }

    if (!buffer || buffer.length === 0) {
      const error = new Error('File cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    if (buffer.length > MAX_FILE_SIZE) {
      const error = new Error('File size exceeds the 50MB limit');
      error.statusCode = 413;
      throw error;
    }

    if (MAGIC_BYTES[mimeType]) {
      const expected = MAGIC_BYTES[mimeType];
      const actual = Array.from(buffer.slice(0, expected.length));
      const match = expected.every((val, idx) => val === actual[idx]);
      if (!match) {
        const error = new Error('File signature does not match declared mime-type');
        error.statusCode = 400;
        throw error;
      }
    }

    const fileId = crypto.randomUUID();
    const saved = await this.storage.saveFile({
      fileId,
      filename,
      buffer,
      mimeType,
      ownerId: userId,
      recipientId: recipientId || null
    });

    return {
      fileId: saved.fileId,
      filename: saved.filename,
      mimeType: saved.mimeType,
      size: saved.size,
      mediaUrl: `/media/${saved.fileId}`
    };
  }

  async getMediaStream(userId, fileId) {
    const meta = await this.storage.getFileMetadata(fileId);
    if (!meta) {
      const error = new Error('Media not found');
      error.statusCode = 404;
      throw error;
    }

    const isOwner = meta.ownerId === userId;
    const isRecipient = meta.recipientId && meta.recipientId === userId;

    if (!isOwner && !isRecipient) {
      const error = new Error('Unauthorized: You do not have permission to view this media');
      error.statusCode = 403;
      throw error;
    }

    const buffer = await this.storage.getFileBuffer(fileId);
    return {
      buffer,
      mimeType: meta.mimeType,
      filename: meta.filename
    };
  }
}

export const mediaService = new MediaService();
