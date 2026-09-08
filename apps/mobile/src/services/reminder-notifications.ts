/**
 * OS notifications for reminders.
 *
 * Blueprint §4 wants reminders that actually fire, with permission, reboot and
 * timezone handling — and honesty about the platform's limits.
 *
 * Design decisions worth stating:
 *
 * - A due *date* is timezone-independent; the notification *instant* is not.
 *   The record keeps the date, and this module derives a local-time instant
 *   (09:00 on the due date) from it, so a reminder does not fire a day early
 *   for someone who crosses a timezone.
 * - Android reschedules `expo-notifications` triggers across reboot itself,
 *   but a device that was off through the due time simply misses it. The app
 *   re-syncs every reminder on launch so anything still pending is rescheduled
 *   and anything past is dropped rather than left as a stale trigger.
 * - Permission is requested when the user sets their first reminder, not at
 *   startup.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { ActionRecord } from "@katibay/shared";

const ANDROID_CHANNEL_ID = "keeptrail-reminders";
/** Local hour a reminder fires on its due date. */
const REMINDER_HOUR = 9;

export type PermissionOutcome = "granted" | "denied" | "blocked";

let handlerConfigured = false;

function configureHandler(): void {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    description: "Return windows, refunds and reimbursement deadlines you set.",
    sound: null,
    vibrationPattern: [0, 200],
  });
}

/** Current permission state without prompting. */
export async function getNotificationPermission(): Promise<PermissionOutcome> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return "granted";
  return settings.canAskAgain ? "denied" : "blocked";
}

/** Requests permission. Called when the user sets a reminder, not at launch. */
export async function requestNotificationPermission(): Promise<PermissionOutcome> {
  configureHandler();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    await ensureAndroidChannel();
    return "granted";
  }
  if (!existing.canAskAgain) return "blocked";

  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) {
    await ensureAndroidChannel();
    return "granted";
  }
  return requested.canAskAgain ? "denied" : "blocked";
}

/**
 * The local instant a reminder should fire, or null when the due date has
 * already passed. Built from local calendar parts so it lands at 09:00 in
 * whatever timezone the phone is in when it fires.
 */
export function reminderInstant(dueDate: string, now: Date = new Date()): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const instant = new Date(Number(year), Number(month) - 1, Number(day), REMINDER_HOUR, 0, 0, 0);
  return instant.getTime() <= now.getTime() ? null : instant;
}

/** Stable notification id for a reminder, so rescheduling replaces rather than duplicates. */
function identifierFor(action: ActionRecord): string {
  return `keeptrail-action-${action.id}`;
}

/** Cancels any scheduled notification for one reminder. */
export async function cancelReminder(action: ActionRecord): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifierFor(action));
  } catch {
    // Cancelling something that was never scheduled is not an error.
  }
}

/**
 * Schedules (or reschedules) one reminder.
 *
 * Returns false when nothing was scheduled — a completed reminder, a due date
 * already in the past, or a date the device cannot represent. Callers use that
 * to tell the user plainly instead of implying a notification will arrive.
 */
export async function scheduleReminder(action: ActionRecord): Promise<boolean> {
  configureHandler();
  await ensureAndroidChannel();
  await cancelReminder(action);

  if (action.status === "completed") return false;
  const instant = reminderInstant(action.due_date);
  if (!instant) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: identifierFor(action),
    content: {
      title: action.title,
      body: action.notes?.trim() || "Due today in Keeptrail.",
      // Carries no receipt content: a notification is visible on a lock screen.
      data: { actionId: action.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: instant,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
  return true;
}

/**
 * Brings the OS schedule in line with the vault.
 *
 * Run on launch. Anything pending and still in the future is (re)scheduled;
 * everything else is cleared, so a completed or deleted reminder cannot fire.
 */
export async function syncScheduledReminders(
  actions: ActionRecord[],
): Promise<{ scheduled: number; skipped: number }> {
  configureHandler();
  await ensureAndroidChannel();

  const wanted = new Map(actions.map((action) => [identifierFor(action), action]));

  // Drop triggers whose reminder no longer exists.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of existing) {
    if (
      notification.identifier.startsWith("keeptrail-action-") &&
      !wanted.has(notification.identifier)
    ) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  let scheduled = 0;
  let skipped = 0;
  for (const action of actions) {
    if (await scheduleReminder(action)) scheduled++;
    else skipped++;
  }
  return { scheduled, skipped };
}
