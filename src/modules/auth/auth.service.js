import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { normalizePhoneNumber } from './auth.utils.js';
import { userRepository } from './userRepositoryFactory.js';
import { validatePasscodeStrength } from '../../core/security.js';

export class AuthService {
  constructor(userRepo = userRepository) {
    this.userRepo = userRepo;
    this.failedAttempts = new Map();
  }

  checkLockout(identifier) {
    const record = this.failedAttempts.get(identifier);
    if (!record) return;
    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingMinutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
      const error = new Error(`Account temporarily locked. Try again in ${remainingMinutes} minute(s).`);
      error.statusCode = 429;
      throw error;
    }
    if (record.lockedUntil && now >= record.lockedUntil) {
      this.failedAttempts.delete(identifier);
    }
  }

  recordFailedAttempt(identifier) {
    let record = this.failedAttempts.get(identifier);
    if (!record) {
      record = { count: 1, lockedUntil: null };
      this.failedAttempts.set(identifier, record);
    } else {
      record.count += 1;
    }
    if (record.count >= 4) {
      record.lockedUntil = Date.now() + (10 * 60 * 1000);
      const error = new Error('Too many failed attempts (4/4). Locked for 10 minutes.');
      error.statusCode = 429;
      throw error;
    }
  }

  resetFailedAttempts(identifier) {
    this.failedAttempts.delete(identifier);
  }

  async register(rawPhone, passcode) {
    const phoneNumber = normalizePhoneNumber(rawPhone);

    try {
      validatePasscodeStrength(passcode);
    } catch (err) {
      err.statusCode = 400;
      throw err;
    }

    const existing = await this.userRepo.findUserByPhone(phoneNumber);
    if (existing && existing.passwordHash) {
      const error = new Error('Phone number already registered. Please log in.');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(passcode, 10);
    const user = existing
      ? await this.userRepo.updateUserPassword(phoneNumber, passwordHash)
      : await this.userRepo.createUser({ id: crypto.randomUUID(), phoneNumber, passwordHash });

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await this.userRepo.createSession(sessionToken, {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      createdAt: Date.now()
    });

    return {
      success: true,
      sessionToken,
      user: { id: user.id, phoneNumber: user.phoneNumber }
    };
  }

  async login(rawPhone, passcode) {
    const phoneNumber = normalizePhoneNumber(rawPhone);
    this.checkLockout(phoneNumber);

    const user = await this.userRepo.findUserByPhone(phoneNumber);
    if (!user || !user.passwordHash) {
      this.recordFailedAttempt(phoneNumber);
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    const isValid = await bcrypt.compare(passcode, user.passwordHash);
    if (!isValid) {
      this.recordFailedAttempt(phoneNumber);
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    this.resetFailedAttempts(phoneNumber);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await this.userRepo.createSession(sessionToken, {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      createdAt: Date.now()
    });

    return {
      success: true,
      sessionToken,
      user: { id: user.id, phoneNumber: user.phoneNumber }
    };
  }

  async getSessionUser(sessionToken) {
    if (!sessionToken) return null;
    const session = await this.userRepo.getSession(sessionToken);
    if (!session) return null;
    const user = await this.userRepo.findUserByPhone(session.phoneNumber);
    if (!user) return null;
    return { id: user.id, phoneNumber: user.phoneNumber };
  }

  async logout(sessionToken) {
    if (sessionToken) {
      await this.userRepo.deleteSession(sessionToken);
    }
  }
}

export const authService = new AuthService();
