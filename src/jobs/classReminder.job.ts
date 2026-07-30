import cron from "node-cron";
import * as classRepository from "../repositories/class.repository";
import * as NotificationService from "../services/notification.service";

const REMINDER_WINDOW_MINUTES = 60;

/**
 * Returns when this class's NEXT session starts, given its recurrence
 * pattern. Same reasoning as the status/expiry logic elsewhere in this
 * codebase: a recurring class's original anchor `schedule` date is
 * just the first-ever occurrence, not "the" date — what matters here
 * is today's occurrence (if the class runs today at all).
 *
 * Returns null if there's no session today (e.g. a weekly class on a
 * day that isn't one of its recurrenceDays) — the job simply won't
 * fire for it today, which is correct; it'll fire on the right day
 * instead.
 */
function getTodaysSessionStart(
  scheduleAnchor: Date,
  recurrence: string,
  recurrenceDays: string[],
  now: Date,
): Date | null {
  if (recurrence === "none") {
    // One-off class — there's only ever one occurrence: the anchor
    // itself. Already-passed one-offs return null (nothing to remind).
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
    recurrence === "monthly" || // not reachable via current UI, safe fallback
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
 * True if `date` falls on the same calendar day as `now`, in the
 * app's timezone — used to make sure a class only gets reminded once
 * per day, even though this job runs every 15 minutes and a session's
 * "starting within the hour" window spans several ticks.
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

      // Not starting soon enough yet, or already started/passed.
      if (
        minutesUntilStart < 0 ||
        minutesUntilStart > REMINDER_WINDOW_MINUTES
      ) {
        continue;
      }

      // Already reminded for today's occurrence — skip.
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
      // One bad class shouldn't halt reminders for every other class.
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
 * Runs every 15 minutes — frequent enough to reliably catch the
 * 60-minute "starting soon" window without much lag, since the window
 * itself is much larger than the check interval.
 */
export const startClassReminderJob = () => {
  cron.schedule("*/15 * * * *", runClassReminders);
  console.log("🕐 Class reminder job scheduled (every 15 minutes)");
};
