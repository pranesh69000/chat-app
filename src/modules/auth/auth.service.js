import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { normalizePhoneNumber, generateOtp, hashOtp } from './auth.utils.js';
import { smsService } from '../../infrastructure/sms/devSmsService.js';
import { userRepository } from './userRepositoryFactory.js';
import { config } from '../../config/env.js';
import { validatePasscodeStrength } from '../../core/security.js';

export class AuthService {
  constructor(userRepo = userRepository, sms = smsService) {
    this.userRepo = userRepo;
    this.sms = sms;
    this.failedAttempts = new Map();
  }

  checkLockout(identifier) {
    const record = this.failedAttempts.get(identifier);
    if (!record) return;

    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingMinutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
      const error = new Error(`Account temporarily locked due to 4 consecutive failed attempts. Please try again in ${remainingMinutes} minute(s).`);
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
      const error = new Error('Too many failed attempts (4/4). Access locked for 10 minutes.');
      error.statusCode = 429;
      throw error;
    }
  }

  resetFailedAttempts(identifier) {
    this.failedAttempts.delete(identifier);
  }

  async requestOtp(rawPhone) {
    const phoneNumber = normalizePhoneNumber(rawPhone);
    const existingOtp = await this.userRepo.getOtp(phoneNumber);
    const now = Date.now();

    if (existingOtp && now - existingOtp.createdAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - existingOtp.createdAt)) / 1000);
      const error = new Error(`Please wait ${waitSeconds} seconds before requesting a new OTP`);
      error.statusCode = 429;
      throw error;
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp, config.SESSION_SECRET);
    const expiryTime = now + (config.OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.userRepo.saveOtp(phoneNumber, {
      phoneNumber,
      otpHash,
      createdAt: now,
      expiresAt: expiryTime,
      attempts: 0
    });

    await this.sms.sendOtp(phoneNumber, otp);
    const existingUser = await this.userRepo.findUserByPhone(phoneNumber);

    return {
      success: true,
      phoneNumber,
      isRegistered: !!(existingUser && existingUser.passwordHash)
    };
  }

  async verifyOtp(rawPhone, otp) {
    const phoneNumber = normalizePhoneNumber(rawPhone);
    const otpRecord = await this.userRepo.getOtp(phoneNumber);

    if (!otpRecord) {
      const error = new Error('No active OTP found. Please request an OTP.');
      error.statusCode = 400;
      throw error;
    }

    const now = Date.now();

    if (now > otpRecord.expiresAt) {
      await this.userRepo.deleteOtp(phoneNumber);
      const error = new Error('OTP has expired. Please request a new one.');
      error.statusCode = 400;
      throw error;
    }

    if (otpRecord.attempts >= 3) {
      await this.userRepo.deleteOtp(phoneNumber);
      const error = new Error('Too many failed attempts. Please request a new OTP.');
      error.statusCode = 429;
      throw error;
    }

    const candidateHash = hashOtp(otp, config.SESSION_SECRET);
    if (candidateHash !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await this.userRepo.saveOtp(phoneNumber, otpRecord);
      const error = new Error('Invalid OTP');
      error.statusCode = 400;
      throw error;
    }

    await this.userRepo.deleteOtp(phoneNumber);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await this.userRepo.createSession(`verify:${verificationToken}`, {
      phoneNumber,
      type: 'otp_verified',
      expiresAt: now + (10 * 60 * 1000)
    });

    const existingUser = await this.userRepo.findUserByPhone(phoneNumber);

    return {
      success: true,
      verificationToken,
      phoneNumber,
      isRegistered: !!(existingUser && existingUser.passwordHash)
    };
  }

  async setPassword(verificationToken, passcode) {
    try {
      validatePasscodeStrength(passcode);
    } catch (err) {
      err.statusCode = 400;
      throw err;
    }

    const session = await this.userRepo.getSession(`verify:${verificationToken}`);
    if (!session || session.type !== 'otp_verified' || Date.now() > session.expiresAt) {
      const error = new Error('Invalid or expired verification token. Please verify OTP first.');
      error.statusCode = 401;
      throw error;
    }

    const { phoneNumber } = session;
    const passwordHash = await bcrypt.hash(passcode, 10);

    let user = await this.userRepo.findUserByPhone(phoneNumber);
    if (!user) {
      user = await this.userRepo.createUser({
        id: crypto.randomUUID(),
        phoneNumber,
        passwordHash
      });
    } else {
      user = await this.userRepo.updateUserPassword(phoneNumber, passwordHash);
    }

    await this.userRepo.deleteSession(`verify:${verificationToken}`);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await this.userRepo.createSession(sessionToken, {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      createdAt: Date.now()
    });

    return {
      success: true,
      message: 'Passcode registered successfully',
      sessionToken,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber
      }
    };
  }

  async loginWithPassword(rawPhone, password) {
    const phoneNumber = normalizePhoneNumber(rawPhone);
    this.checkLockout(phoneNumber);

    const user = await this.userRepo.findUserByPhone(phoneNumber);

    if (!user || !user.passwordHash) {
      this.recordFailedAttempt(phoneNumber);
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      throw error;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
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
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber
      }
    };
  }

  async unlockWithPasscode(passcode, clientIp = 'default-client') {
    if (!passcode) {
      const error = new Error('Passcode is required');
      error.statusCode = 400;
      throw error;
    }

    this.checkLockout(clientIp);

    // Fetch all registered users whether from DynamoDB or In-Memory
    const allUsers = this.userRepo.getAllRegisteredUsers
      ? await this.userRepo.getAllRegisteredUsers()
      : Array.from(this.userRepo.users.values());

    let matchedUser = null;

    for (const user of allUsers) {
      if (user.passwordHash) {
        const matches = await bcrypt.compare(passcode, user.passwordHash);
        if (matches) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      this.recordFailedAttempt(clientIp);
      const error = new Error('Incorrect passcode');
      error.statusCode = 401;
      throw error;
    }

    this.resetFailedAttempts(clientIp);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await this.userRepo.createSession(sessionToken, {
      userId: matchedUser.id,
      phoneNumber: matchedUser.phoneNumber,
      createdAt: Date.now()
    });

    return {
      success: true,
      sessionToken,
      user: {
        id: matchedUser.id,
        phoneNumber: matchedUser.phoneNumber
      }
    };
  }

  async getSessionUser(sessionToken) {
    if (!sessionToken) return null;
    const session = await this.userRepo.getSession(sessionToken);
    if (!session) return null;
    const user = await this.userRepo.findUserByPhone(session.phoneNumber);
    if (!user) return null;
    return {
      id: user.id,
      phoneNumber: user.phoneNumber
    };
  }
}

export const authService = new AuthService();
