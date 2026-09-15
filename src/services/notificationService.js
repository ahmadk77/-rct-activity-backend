const admin = require('firebase-admin');
const FeatureFlag = require('../models/FeatureFlag');
const User = require('../models/User');

// Initialize Firebase Admin
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountPath && serviceAccountPath !== './firebase-service-account.json.example') {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseInitialized = true;
      console.log('Firebase Admin initialized successfully');
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // Use environment variables for Firebase config
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      firebaseInitialized = true;
      console.log('Firebase Admin initialized successfully');
    } else {
      console.log('Firebase Admin not configured - notifications will be disabled');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    console.log('Firebase notifications will be disabled');
  }
}

class NotificationService {
  constructor() {
    initializeFirebase();
  }

  async sendPushNotification(userId, title, body, data = {}) {
    try {
      // Check if push notifications are enabled
      const pushEnabled = await FeatureFlag.isEnabled('push_notifications', userId);
      if (!pushEnabled) {
        console.log('Push notifications disabled for user:', userId);
        return { success: false, reason: 'disabled' };
      }

      // Get user's FCM token
      const user = await User.findById(userId);
      if (!user || !user.fcm_token) {
        console.log('No FCM token found for user:', userId);
        return { success: false, reason: 'no_token' };
      }

      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: data,
        token: user.fcm_token,
        android: {
          priority: 'high',
          notification: {
            channel_id: 'high_importance_channel',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: title,
                body: body,
              },
              badge: 1,
              sound: 'default',
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      
      // Save notification to database
      await this.saveNotificationToDatabase(userId, title, body, data);
      
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMulticastNotification(userIds, title, body, data = {}) {
    try {
      // Get all FCM tokens
      const users = await Promise.all(userIds.map(id => User.findById(id)));
      const tokens = users.filter(user => user && user.fcm_token).map(user => user.fcm_token);
      
      if (tokens.length === 0) {
        return { success: false, reason: 'no_tokens' };
      }

      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: data,
        tokens: tokens,
      };

      const response = await admin.messaging().sendMulticast(message);
      console.log('Multicast message sent:', response);
      
      // Save notifications to database
      for (const userId of userIds) {
        await this.saveNotificationToDatabase(userId, title, body, data);
      }
      
      return { 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount 
      };
    } catch (error) {
      console.error('Error sending multicast notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTopicNotification(topic, title, body, data = {}) {
    try {
      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: data,
        topic: topic,
      };

      const response = await admin.messaging().send(message);
      console.log('Topic message sent:', response);
      
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending topic notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendScheduledNotifications(userId, message_type) {
    const timeFlags = {
      'morning': 'morning_notifications',
      'noon': 'noon_notifications', 
      'evening': 'evening_notifications'
    };

    const flagName = timeFlags[message_type];
    if (!flagName) return;

    const enabled = await FeatureFlag.isEnabled(flagName, userId);
    if (!enabled) return;

    // Get user language and cultural profile
    const user = await User.findById(userId);
    const language = user?.language || 'ar';
    
    // Generate message content based on type and language
    const { title, body } = this.getNotificationContent(message_type, language);
    
    await this.sendPushNotification(userId, title, body, { type: message_type });
  }

  getNotificationContent(message_type, language) {
    const isArabic = language === 'ar';
    
    if (message_type === 'morning') {
      return {
        title: isArabic ? 'صباح الخير!' : 'Good Morning!',
        body: isArabic ? 'ابدأ يومك بحركة بسيطة لزيادة طاقتك.' : 'Start your day with simple movement to boost your energy.'
      };
    } else if (message_type === 'noon') {
      return {
        title: isArabic ? 'تذكير منتصف اليوم' : 'Mid-day Reminder',
        body: isArabic ? 'وقت رائع للتحرك قليلاً!' : 'Great time to move a little!'
      };
    } else if (message_type === 'evening') {
      return {
        title: isArabic ? 'مساء الخير' : 'Good Evening',
        body: isArabic ? 'راجع إنجازك اليوم واستعد ليوم غد!' : 'Review your day\'s progress and prepare for tomorrow!'
      };
    }
    
    return {
      title: isArabic ? 'إشعار' : 'Notification',
      body: isArabic ? 'رسالة من تطبيق RCT Activity' : 'Message from RCT Activity App'
    };
  }

  async sendFamilyInteractionNotification(userId, interactionType, senderName) {
    const interactionMessages = {
      'clap': { ar: '👏 صفق لك!', en: '👏 Clapped for you!' },
      'love': { ar: '❤️ أحب تقدمك!', en: '❤️ Loves your progress!' },
      'celebrate': { ar: '🎉 يحتفل بإنجازك!', en: '🎉 Celebrates your achievement!' },
    };

    const user = await User.findById(userId);
    const language = user?.language || 'ar';
    const message = interactionMessages[interactionType]?.[language] || interactionMessages[interactionType]?.['ar'];
    
    const title = language === 'ar' ? 'تفاعل من العائلة' : 'Family Interaction';
    const body = `${senderName} ${message}`;
    
    await this.sendPushNotification(userId, title, body, { 
      type: 'family_interaction', 
      interaction_type: interactionType 
    });
  }

  async sendAchievementNotification(userId, achievementType, achievementDetails) {
    const user = await User.findById(userId);
    const language = user?.language || 'ar';
    
    const title = language === 'ar' ? '🎉 إنجاز جديد!' : '🎉 New Achievement!';
    const body = language === 'ar' 
      ? `مبروك! حصلت على ${achievementDetails.name}`
      : `Congratulations! You earned ${achievementDetails.name}`;
    
    await this.sendPushNotification(userId, title, body, { 
      type: 'achievement', 
      achievement_type: achievementType 
    });
  }

  async saveNotificationToDatabase(userId, title, body, payload) {
    try {
      const pool = require('../database/connection').pool;
      await pool.query(
        `INSERT INTO push_notifications (user_id, notification_type, title, body, payload) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, payload.type || 'general', title, body, JSON.stringify(payload)]
      );
    } catch (error) {
      console.error('Error saving notification to database:', error);
    }
  }

  async updateFCMToken(userId, fcmToken) {
    try {
      // This would update the user's FCM token in the database
      // Implementation depends on your user model structure
      console.log(`Updating FCM token for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error updating FCM token:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();