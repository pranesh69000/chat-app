/**
 * Notification Service Abstraction.
 * In a discreet private chat app, notifications must NEVER reveal sensitive message content.
 * Delivers generic, discreet notifications (e.g. "You have a new message" or customized subtle wording).
 */
export class NotificationService {
  constructor() {
    this.preferences = new Map(); // userId -> { enabled: boolean, wording: string }
    this.sentNotifications = [];
  }

  setPreferences(userId, { enabled = true, wording = 'New discreet notification' } = {}) {
    this.preferences.set(userId, { enabled, wording });
    return this.preferences.get(userId);
  }

  getPreferences(userId) {
    return this.preferences.get(userId) || { enabled: true, wording: 'New discreet notification' };
  }

  /**
   * Formats a safe notification without leaking private text or sender identity
   */
  async notifyNewMessage(recipientId) {
    const prefs = this.getPreferences(recipientId);
    if (!prefs.enabled) return null;

    const notification = {
      recipientId,
      title: 'Reminder',
      body: prefs.wording, // Completely discreet, hides message text
      timestamp: Date.now()
    };

    this.sentNotifications.push(notification);
    return notification;
  }

  clear() {
    this.sentNotifications = [];
    this.preferences.clear();
  }
}

export const notificationService = new NotificationService();
