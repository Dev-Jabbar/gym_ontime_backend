import cron from "node-cron";
import * as classRepository from "../repositories/class.repository";
import * as NotificationService from "../services/notification.service";

const REMINDER_WINDOW_MINUTES = 60;

/**
 * Returns when this class's session today starts, given its recurrence
 * pattern. A recurring class's original `schedule` date is only its
 * first-ever occurrence; what matters here is today's occurrence, if the
 * class runs today at all.
 *
 * Returns null when there is no session today (for example a weekly class
 * on a day that is not one of its recurrenceDays). The job then does nothing
 * for that class today.
 */
function getTodaysSessionStart(
  scheduleAnchor: Date,
  recurrence: string,
  recurrenceDays: string[],
  now: Date,
): Date | null {
  if (recurrence === "none") {
    // One-off class: there is only one occurrence, the anchor itself.
    // One-offs that have already passed return null (nothing to remind).
    return scheduleAnchor > now ? scheduleAnchor : null;
  }

  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayName = dayNames[now.getDay()];

  const isValidDayToday =
    recurrence === "daily" ||
    recurrence === "monthly" || // Not offered in the UI; treated as every day.
    (recurrence === "weekly" && recurrenceDays.includes(todayName));

  if (!isValidDayToday) return null;

  const todaysStart = new Date(now);
  todaysStart.setHours(
    scheduleAnchor.getHours(),
    scheduleAnchor.getMinutes(),
    scheduleAnchor.getSeconds(),
    0,
  );

  return todaysStart;
}

/**
 * True if `date` falls on the same calendar day as `now` in the app's time
 * zone. Used to remind a class at most once per day, even though the job
 * runs every 15 minutes and the "starting within the hour" window spans
 * several runs.
 */
function isSameCalendarDay(date: Date, now: Date): boolean {
  const dateStr = date.toLocaleDateString("en-NG", {
    timeZone: "Africa/Lagos",
  });
  const nowStr = now.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" });
  return dateStr === nowStr;
}

export const runClassReminders = async () => {
  console.log("🔔 Running class reminder sweep...");

  const now = new Date();
  const classes = await classRepository.findAllClassesForReminderCheck();
  let remindersSent = 0;

  for (const cls of classes) {
    try {
      const scheduleAnchor = new Date((cls as any).schedule);
      const sessionStart = getTodaysSessionStart(
        scheduleAnchor,
        (cls as any).recurrence,
        (cls as any).recurrenceDays ?? [],
        now,
      );

      if (!sessionStart) continue;

      const minutesUntilStart =
        (sessionStart.getTime() - now.getTime()) / 60000;

      // Not starting soon enough yet, or already started or passed.
      if (
        minutesUntilStart < 0 ||
        minutesUntilStart > REMINDER_WINDOW_MINUTES
      ) {
        continue;
      }

      // Already reminded for today's session: skip.
      const lastSent = (cls as any).lastReminderSentAt;
      if (lastSent && isSameCalendarDay(new Date(lastSent), now)) {
        continue;
      }

      const members = (cls as any).members ?? [];
      if (members.length === 0) continue;

      for (const member of members) {
        const memberUserId = member?.userId?._id?.toString();
        if (!memberUserId) continue;

        await NotificationService.notify({
          userId: memberUserId,
          type: "class_reminder",
          title: "Class Starting Soon",
          message: `"${(cls as any).name}" starts in about an hour.`,
          classId: (cls as any)._id.toString(),
        });
      }

      await classRepository.markReminderSent((cls as any)._id.toString(), now);
      remindersSent++;
    } catch (err) {
      // One failing class must not stop reminders for the others.
      console.log(
        `⚠️ Could not process reminder for class ${(cls as any)._id}:`,
        err,
      );
    }
  }

  console.log(
    `🔔 Reminder sweep complete — sent reminders for ${remindersSent} class(es)`,
  );
};

/**
 * Runs every 15 minutes. The "starting soon" window (60 minutes) is much
 * larger than the check interval, so no class is missed.
 */
export const startClassReminderJob = () => {
  cron.schedule("*/15 * * * *", runClassReminders);
  console.log("🕐 Class reminder job scheduled (every 15 minutes)");
};
