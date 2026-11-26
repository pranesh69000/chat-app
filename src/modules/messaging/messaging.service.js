import crypto from 'node:crypto';
import { messageRepository } from './messageRepositoryFactory.js';
import { userRepository } from '../auth/userRepositoryFactory.js';

export class MessagingService {
  constructor(msgRepo = messageRepository, userRepo = userRepository) {
    this.msgRepo = msgRepo;
    this.userRepo = userRepo;
  }

  async sendMessage({ senderId, recipientId, content, type = 'text', mediaUrl = null, clientMessageId = null }) {
    if (!content && !mediaUrl) {
      const error = new Error('Message content or media is required');
      error.statusCode = 400;
      throw error;
    }

    if (!recipientId) {
      const error = new Error('Recipient ID is required');
      error.statusCode = 400;
      throw error;
    }

    const allUsers = this.userRepo.getAllRegisteredUsers
      ? await this.userRepo.getAllRegisteredUsers()
      : Array.from(this.userRepo.users.values());

    const recipient = allUsers.find(u => u.id === recipientId);
    if (!recipient) {
      const error = new Error('Recipient is not registered');
      error.statusCode = 404;
      throw error;
    }

    if (clientMessageId) {
      const existing = await this.msgRepo.findByIdempotencyKey(senderId, clientMessageId);
      if (existing) {
        return existing;
      }
    }

    const conversationId = this.msgRepo.getConversationId(senderId, recipientId);
    const messageId = crypto.randomUUID();
    const now = Date.now();

    const message = {
      id: messageId,
      conversationId,
      senderId,
      recipientId,
      content: content ? content.trim() : '',
      type,
      mediaUrl,
      status: 'sent',
      clientMessageId,
      createdAt: now,
      deliveredAt: null,
      readAt: null
    };

    const saved = await this.msgRepo.saveMessage(message);
    return saved;
  }

  async getConversationHistory(userId, otherUserId, { limit = 50, before = null } = {}) {
    const conversationId = this.msgRepo.getConversationId(userId, otherUserId);
    const beforeTimestamp = before ? parseInt(before, 10) : null;

    const messages = await this.msgRepo.getMessagesByConversationId(conversationId, {
      limit: Math.min(limit, 100),
      beforeTimestamp
    });

    return {
      conversationId,
      otherUserId,
      messages
    };
  }

  async getUserConversations(userId) {
    return this.msgRepo.getUserConversations ? this.msgRepo.getUserConversations(userId) : [];
  }

  async updateStatus(userId, messageId, status) {
    if (!['delivered', 'read'].includes(status)) {
      const error = new Error('Status must be either "delivered" or "read"');
      error.statusCode = 400;
      throw error;
    }

    return this.msgRepo.updateMessageStatus(messageId, status);
  }
}

export const messagingService = new MessagingService();
