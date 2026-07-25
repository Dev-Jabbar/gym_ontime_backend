import * as notificationRepository from "../repositories/notification.repository";
import type { NotificationType } from "../models/notification.model";

export const getMyNotifications = async (userId: string) => {
  const [notifications, unreadCount] = await Promise.all([
    notificationRepository.findByUserId(userId),
    notificationRepository.countUnread(userId),
  ]);

  return { notifications, unreadCount };
};

export const markNotificationAsRead = async (
  notificationId: string,
  userId: string,
) => {
  return notificationRepository.markAsRead(notificationId, userId);
};

export const markAllNotificationsAsRead = async (userId: string) => {
  return notificationRepository.markAllAsRead(userId);
};

/**
 * Called by OTHER services (payment.service.ts, etc.) whenever
 * something notification-worthy happens. Kept as a single entry point
 * so every notification is created the same way, with the same shape.
 */
export const notify = async ({
  userId,
  type,
  title,
  message,
  classId,
  paymentId,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  classId?: string;
  paymentId?: string;
}) => {
  try {
    await notificationRepository.createNotification({
      user: userId as any,
      type,
      title,
      message,
      ...(classId && { relatedClass: classId as any }),
      ...(paymentId && { relatedPayment: paymentId as any }),
    });
  } catch (err) {
    // A notification failing to save should NEVER break the actual
    // action that triggered it (e.g. a payment completing). Log and
    // move on rather than throw.
    console.error("Failed to create notification:", err);
  }
};
