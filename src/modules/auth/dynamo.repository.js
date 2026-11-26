import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient } from '../../infrastructure/database/dynamoClient.js';
import { config } from '../../config/env.js';

/**
 * AWS DynamoDB Single-Table User Repository
 * Partition Key (PK) & Sort Key (SK) Design:
 * - User Profile: PK: USER#<phoneNumber>, SK: PROFILE
 * - User by ID:   PK: USERID#<userId>,      SK: MAPPING
 * - OTP Record:   PK: OTP#<phoneNumber>,    SK: ACTIVE
 * - Session:      PK: SESSION#<token>,      SK: METADATA
 */
export class DynamoUserRepository {
  constructor(tableName = config.DYNAMODB_TABLE_NAME) {
    this.tableName = tableName;
  }

  get client() {
    return getDynamoClient();
  }

  async findUserByPhone(phoneNumber) {
    const cmd = new GetCommand({
      TableName: this.tableName,
      Key: { PK: `USER#${phoneNumber}`, SK: 'PROFILE' }
    });
    const res = await this.client.send(cmd);
    return res.Item ? res.Item.data : null;
  }

  async createUser(user) {
    const userData = { ...user, createdAt: Date.now() };

    // 1. Save user profile
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `USER#${user.phoneNumber}`,
        SK: 'PROFILE',
        data: userData
      }
    }));

    // 2. Save reverse lookup for ID -> Phone
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `USERID#${user.id}`,
        SK: 'MAPPING',
        phoneNumber: user.phoneNumber
      }
    }));

    return userData;
  }

  async updateUserPassword(phoneNumber, passwordHash) {
    const existing = await this.findUserByPhone(phoneNumber);
    if (!existing) throw new Error('User not found');

    existing.passwordHash = passwordHash;
    existing.updatedAt = Date.now();

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `USER#${phoneNumber}`,
        SK: 'PROFILE',
        data: existing
      }
    }));

    return existing;
  }

  async saveOtp(phoneNumber, otpRecord) {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `OTP#${phoneNumber}`,
        SK: 'ACTIVE',
        data: otpRecord,
        ttl: Math.floor(otpRecord.expiresAt / 1000) // Native DynamoDB automatic TTL cleanup!
      }
    }));
  }

  async getOtp(phoneNumber) {
    const cmd = new GetCommand({
      TableName: this.tableName,
      Key: { PK: `OTP#${phoneNumber}`, SK: 'ACTIVE' }
    });
    const res = await this.client.send(cmd);
    return res.Item ? res.Item.data : null;
  }

  async deleteOtp(phoneNumber) {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { PK: `OTP#${phoneNumber}`, SK: 'ACTIVE' }
    }));
  }

  async createSession(sessionToken, sessionData) {
    const record = { ...sessionData, createdAt: Date.now() };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `SESSION#${sessionToken}`,
        SK: 'METADATA',
        data: record
      }
    }));
    return record;
  }

  async getSession(sessionToken) {
    const cmd = new GetCommand({
      TableName: this.tableName,
      Key: { PK: `SESSION#${sessionToken}`, SK: 'METADATA' }
    });
    const res = await this.client.send(cmd);
    return res.Item ? res.Item.data : null;
  }

  async deleteSession(sessionToken) {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { PK: `SESSION#${sessionToken}`, SK: 'METADATA' }
    }));
  }

  // Scan all registered users (for contact discovery)
  async getAllRegisteredUsers() {
    const cmd = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk',
      ExpressionAttributeValues: {
        ':prefix': 'USER#',
        ':sk': 'PROFILE'
      }
    });
    const res = await this.client.send(cmd);
    return (res.Items || []).map(item => item.data);
  }
}
