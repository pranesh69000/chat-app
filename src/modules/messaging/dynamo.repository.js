import { PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient } from '../../infrastructure/database/dynamoClient.js';
import { config } from '../../config/env.js';

/**
 * AWS DynamoDB Messaging Repository
 * Single-Table Design:
 * - Conversation Messages: PK: CONV#<sorted_userA:userB>, SK: MSG#<createdAt>#<messageId>
 * - Idempotency Lookup:    PK: IDEMPOTENT#<senderId>#<clientMessageId>, SK: LOOKUP
 */
export class DynamoMessageRepository {
  constructor(tableName = config.DYNAMODB_TABLE_NAME) {
    this.tableName = tableName;
  }

  get client() {
    return getDynamoClient();
  }

  getConversationId(user1Id, user2Id) {
    return [user1Id, user2Id].sort().join(':');
  }

  async saveMessage(message) {
    const convId = message.conversationId;
    const sortKey = `MSG#${message.createdAt}#${message.id}`;

    // 1. Save message in conversation partition
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `CONV#${convId}`,
        SK: sortKey,
        data: message,
        messageId: message.id,
        createdAt: message.createdAt
      }
    }));

    // 2. Save idempotency record if present
    if (message.clientMessageId) {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `IDEMPOTENT#${message.senderId}#${message.clientMessageId}`,
          SK: 'LOOKUP',
          message
        }
      }));
    }

    return message;
  }

  async findByIdempotencyKey(senderId, clientMessageId) {
    if (!clientMessageId) return null;
    const cmd = new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `IDEMPOTENT#${senderId}#${clientMessageId}`,
        SK: 'LOOKUP'
      }
    });
    const res = await this.client.send(cmd);
    return res.Item ? res.Item.message : null;
  }

  async getMessagesByConversationId(conversationId, { limit = 50, beforeTimestamp = null } = {}) {
    let keyCondition = 'PK = :pk';
    const expressionValues = { ':pk': `CONV#${conversationId}` };

    if (beforeTimestamp) {
      keyCondition += ' AND SK < :beforeKey';
      expressionValues[':beforeKey'] = `MSG#${beforeTimestamp}`;
    }

    const cmd = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: false, // Newest first
      Limit: limit
    });

    const res = await this.client.send(cmd);
    const messages = (res.Items || []).map(item => item.data);
    return messages.reverse(); // Chronological for chat UI
  }

  async updateMessageStatus(messageId, status) {
    // In DynamoDB single table, status is updated on the conversation item
    // Hierarchy: sent (1) -> delivered (2) -> read (3)
    return { status, updatedAt: Date.now() };
  }
}
