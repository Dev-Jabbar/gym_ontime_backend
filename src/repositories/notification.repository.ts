import NotificationModel, { INotification } from "../models/notification.model";

export const createNotification = async (data: Partial<INotification>) => {
  return NotificationModel.create(data);
};

export const findByUserId = async (userId: string, limit = 30) => {
  return NotificationModel.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

export const countUnread = async (userId: string) => {
  return NotificationModel.countDocuments({ user: userId, read: false });
};

export const markAsRead = async (notificationId: string, userId: string) => {
  // Scoped to userId as well, so a user can only mark their own
  // notifications as read and cannot guess another user's id.
  return NotificationModel.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { read: true },
    { new: true },
  );
};

export const markAllAsRead = async (userId: string) => {
  return NotificationModel.updateMany(
    { user: userId, read: false },
    { read: true },
  );
};
