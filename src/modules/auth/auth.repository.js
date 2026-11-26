export class InMemoryUserRepository {
  constructor() {
    this.users = new Map();
    this.otps = new Map();
    this.sessions = new Map();
  }

  async findUserByPhone(phoneNumber) {
    const user = this.users.get(phoneNumber);
    return user ? { ...user } : null;
  }

  async createUser(user) {
    this.users.set(user.phoneNumber, { ...user, createdAt: Date.now() });
    return { ...this.users.get(user.phoneNumber) };
  }

  async updateUserPassword(phoneNumber, passwordHash) {
    const user = this.users.get(phoneNumber);
    if (!user) throw new Error('User not found');
    user.passwordHash = passwordHash;
    return { ...user };
  }

  async saveOtp(phoneNumber, otpRecord) {
    this.otps.set(phoneNumber, { ...otpRecord });
  }

  async getOtp(phoneNumber) {
    const record = this.otps.get(phoneNumber);
    return record ? { ...record } : null;
  }

  async deleteOtp(phoneNumber) {
    this.otps.delete(phoneNumber);
  }

  async createSession(sessionToken, sessionData) {
    this.sessions.set(sessionToken, { ...sessionData, createdAt: Date.now() });
    return this.sessions.get(sessionToken);
  }

  async getSession(sessionToken) {
    const session = this.sessions.get(sessionToken);
    return session ? { ...session } : null;
  }

  async deleteSession(sessionToken) {
    this.sessions.delete(sessionToken);
  }

  async clear() {
    this.users.clear();
    this.otps.clear();
    this.sessions.clear();
  }
}

export const userRepository = new InMemoryUserRepository();
