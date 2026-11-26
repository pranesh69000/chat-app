export class InMemoryMessageRepository {
  constructor() {
    this.messages = new Map();
    this.conversationMessages = new Map();
    this.idempotencyMap = new Map();
  }

  getConversationId(user1Id, user2Id) {
    return [user1Id, user2Id].sort().join(':');
  }

  async saveMessage(message) {
    this.messages.set(message.id, { ...message });

    const convId = message.conversationId;
    if (!this.conversationMessages.has(convId)) {
      this.conversationMessages.set(convId, []);
    }
    this.conversationMessages.get(convId).push(message.id);

    if (message.clientMessageId) {
      this.idempotencyMap.set(`${message.senderId}:${message.clientMessageId}`, message.id);
    }

    return { ...message };
  }

  async getMessageById(messageId) {
    const msg = this.messages.get(messageId);
    return msg ? { ...msg } : null;
  }

  async findByIdempotencyKey(senderId, clientMessageId) {
    if (!clientMessageId) return null;
    const existingMsgId = this.idempotencyMap.get(`${senderId}:${clientMessageId}`);
    return existingMsgId ? this.getMessageById(existingMsgId) : null;
  }

  async updateMessageStatus(messageId, status) {
    const msg = this.messages.get(messageId);
    if (!msg) return null;

    const hierarchy = { sent: 1, delivered: 2, read: 3 };
    if (hierarchy[status] && hierarchy[status] > hierarchy[msg.status]) {
      msg.status = status;
      if (status === 'delivered') msg.deliveredAt = Date.now();
      if (status === 'read') msg.readAt = Date.now();
    }
    return { ...msg };
  }

  async getMessagesByConversationId(conversationId, { limit = 50, beforeTimestamp = null } = {}) {
    const ids = this.conversationMessages.get(conversationId) || [];
    let list = ids.map(id => this.messages.get(id)).filter(Boolean);

    if (beforeTimestamp) {
      list = list.filter(m => m.createdAt < beforeTimestamp);
    }

    list.sort((a, b) => b.createdAt - a.createdAt);
    return list.slice(0, limit).reverse();
  }

  async getUserConversations(userId) {
    const userConvMap = new Map();

    for (const [convId, msgIds] of this.conversationMessages.entries()) {
      const parts = convId.split(':');
      if (parts.includes(userId)) {
        const otherUserId = parts[0] === userId ? parts[1] : parts[0];
        const lastMsgId = msgIds[msgIds.length - 1];
        userConvMap.set(otherUserId, {
          conversationId: convId,
          otherUserId,
          lastMessage: this.messages.get(lastMsgId)
        });
      }
    }

    return Array.from(userConvMap.values());
  }

  async clear() {
    this.messages.clear();
    this.conversationMessages.clear();
    this.idempotencyMap.clear();
  }
}

export const messageRepository = new InMemoryMessageRepository();
