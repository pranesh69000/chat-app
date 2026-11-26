import { normalizePhoneNumber } from '../auth/auth.utils.js';
import { userRepository } from '../auth/userRepositoryFactory.js';

export class ContactService {
  constructor(userRepo = userRepository) {
    this.userRepo = userRepo;
  }

  async syncContacts(currentUserId, rawPhoneNumbers = []) {
    const allUsers = this.userRepo.getAllRegisteredUsers
      ? await this.userRepo.getAllRegisteredUsers()
      : Array.from(this.userRepo.users.values());

    const currentUser = allUsers.find(u => u.id === currentUserId);
    const registered = [];
    const notRegistered = [];

    const normalizedNumbers = new Set();

    for (const raw of rawPhoneNumbers) {
      try {
        const phone = normalizePhoneNumber(raw);
        if (currentUser && phone === currentUser.phoneNumber) {
          continue;
        }
        normalizedNumbers.add(phone);
      } catch {
        // Skip
      }
    }

    for (const phone of normalizedNumbers) {
      const user = await this.userRepo.findUserByPhone(phone);
      if (user && user.passwordHash) {
        registered.push({
          userId: user.id,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName || user.phoneNumber,
          status: 'registered'
        });
      } else {
        notRegistered.push({
          phoneNumber: phone,
          status: 'not_registered',
          inviteLink: `Hey, let's chat privately! Join me on Secret XO Chat.`
        });
      }
    }

    return {
      registered,
      notRegistered
    };
  }

  async getRegisteredUsers(currentUserId) {
    const allUsers = this.userRepo.getAllRegisteredUsers
      ? await this.userRepo.getAllRegisteredUsers()
      : Array.from(this.userRepo.users.values());

    return allUsers
      .filter(u => u.id !== currentUserId && u.passwordHash)
      .map(u => ({
        userId: u.id,
        phoneNumber: u.phoneNumber,
        displayName: u.displayName || u.phoneNumber
      }));
  }
}

export const contactService = new ContactService();
