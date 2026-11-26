import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../config/env.js';

/**
 * Cloudflare R2 Storage Service (S3-Compatible API)
 * Offers 10 GB permanently free with ₹0 egress bandwidth charges forever.
 */
export class CloudflareR2StorageService {
  constructor() {
    this.bucketName = config.R2_BUCKET_NAME;
    this.metadataMap = new Map(); // fileId -> metadata
    this.client = null;

    if (config.USE_R2 && config.R2_ACCOUNT_ID) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.R2_ACCESS_KEY_ID,
          secretAccessKey: config.R2_SECRET_ACCESS_KEY
        }
      });
    }
  }

  async saveFile({ fileId, filename, buffer, mimeType, ownerId, recipientId }) {
    const key = `uploads/${fileId}_${filename}`;

    if (this.client) {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType
      }));
    }

    const record = {
      fileId,
      filename,
      mimeType,
      size: buffer.length,
      ownerId,
      recipientId,
      r2Key: key,
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

    if (this.client) {
      const res = await this.client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: meta.r2Key
      }));
      const streamToBuffer = async (stream) => {
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
      };
      return streamToBuffer(res.Body);
    }

    return null;
  }
}

export const r2StorageService = new CloudflareR2StorageService();
