const User = require('../models/User');
const notificationService = require('../services/notificationService');

class NotificationController {
  async registerFCMToken(req, res) {
    try {
      const { fcmToken } = req.body;
      const userId = req.userId;
      if (!fcmToken || typeof fcmToken !== 'string') {
        return res.status(400).json({ success: false, message: 'fcmToken is required' });
      }

      // User id comes from the verified JWT, never from a client-provided body.
      const updatedUser = await User.updateFcmToken(userId, fcmToken);
      if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ 
        success: true, 
        message: 'FCM token registered successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error registering FCM token:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to register FCM token',
        error: error.message 
      });
    }
  }

  async testNotification(req, res) {
    try {
      const { userId, title, body } = req.body;
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'userId is required' 
        });
      }

      const result = await notificationService.sendPushNotification(
        userId, 
        title || 'Test Notification', 
        body || 'This is a test notification from RCT Activity App'
      );

      res.json(result);
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test notification',
        error: error.message 
      });
    }
  }

  async sendScheduledNotification(req, res) {
    try {
      const { userId, messageType } = req.body;
      
      if (!userId || !messageType) {
        return res.status(400).json({ 
          success: false, 
          message: 'userId and messageType are required' 
        });
      }

      await notificationService.sendScheduledNotifications(userId, messageType);

      res.json({ 
        success: true, 
        message: 'Scheduled notification sent successfully'
      });
    } catch (error) {
      console.error('Error sending scheduled notification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send scheduled notification',
        error: error.message 
      });
    }
  }

  async sendFamilyInteractionNotification(req, res) {
    try {
      const { userId, interactionType, senderName } = req.body;
      
      if (!userId || !interactionType || !senderName) {
        return res.status(400).json({ 
          success: false, 
          message: 'userId, interactionType, and senderName are required' 
        });
      }

      await notificationService.sendFamilyInteractionNotification(
        userId, 
        interactionType, 
        senderName
      );

      res.json({ 
        success: true, 
        message: 'Family interaction notification sent successfully'
      });
    } catch (error) {
      console.error('Error sending family interaction notification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send family interaction notification',
        error: error.message 
      });
    }
  }

  async sendAchievementNotification(req, res) {
    try {
      const { userId, achievementType, achievementDetails } = req.body;
      
      if (!userId || !achievementType) {
        return res.status(400).json({ 
          success: false, 
          message: 'userId and achievementType are required' 
        });
      }

      await notificationService.sendAchievementNotification(
        userId, 
        achievementType, 
        achievementDetails || {}
      );

      res.json({ 
        success: true, 
        message: 'Achievement notification sent successfully'
      });
    } catch (error) {
      console.error('Error sending achievement notification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send achievement notification',
        error: error.message 
      });
    }
  }
}

module.exports = new NotificationController();