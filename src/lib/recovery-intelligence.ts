export type RecoveryIntentId =
  | "fill_capacity"
  | "rebook"
  | "reduce_no_show"
  | "win_back"
  | "upsell"
  | "protect_booking"
  | "follow_up";

export type RecoveryRecord = {
  id: string;
  title?: string | null;
  description?: string | null;
  nextStep?: string | null;
  status?: string | null;
  stageKey?: string | null;
  stageName?: string | null;
  companyName?: string | null;
  primaryPersonName?: string | null;
  valueAmount?: number | string | null;
  probability?: number | string | null;
  expectedCloseDate?: string | Date | null;
  latestActivityAt?: string | Date | null;
  openTaskCount?: number | string | null;
};

export type RecoveryTask = {
  id: string;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  dueAt?: string | Date | null;
  companyName?: string | null;
  dealTitle?: string | null;
  personName?: string | null;
};

export type RecoveryActivity = {
  id: string;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  occurredAt?: string | Date | null;
  companyName?: string | null;
  dealTitle?: string | null;
  personName?: string | null;
};

const INTENTS: Record<RecoveryIntentId, string[]> = {
  fill_capacity: [
    "gap",
    "empty",
    "slot",
    "availability",
    "capacity",
    "walk in",
    "walk-in",
    "pipeline gap",
  ],
  rebook: [
    "rebook",
    "return",
    "next visit",
    "follow up",
    "follow-up",
    "meeting",
    "demo",
    "call",
  ],
  reduce_no_show: [
    "no show",
    "no-show",
    "deposit",
    "confirm",
    "confirmation",
    "reminder",
    "late cancel",
    "cancellation",
    "deadline",
    "timeline",
  ],
  win_back: [
    "lapsed",
    "inactive",
    "lost",
    "dormant",
    "win back",
    "winback",
    "not seen",
    "reactivate",
  ],
  upsell: [
    "upgrade",
    "add on",
    "add-on",
    "package",
    "membership",
    "bundle",
    "premium",
    "course",
  ],
  protect_booking: [
    "risk",
    "uncertain",
    "maybe",
    "hold",
    "reschedule",
    "tentative",
    "waiting",
  ],
  follow_up: [
    "call",
    "email",
    "message",
    "text",
    "reply",
    "send",
    "chase",
    "task",
  ],
};

const ORDERED_INTENTS = Object.keys(INTENTS) as RecoveryIntentId[];

export function classifyRecoveryIntent(
  record: RecoveryRecord,
  now = new Date(),
): RecoveryIntentId {
  return scoreRecord(record, now).primaryIntent;
}

function scoreRecord(record: RecoveryRecord, now: Date) {
  const text = normalize(
    `${clean(record.title)} ${clean(record.description)} ${clean(record.nextStep)} ${clean(record.stageName)}`,
  );
  const scores = scoreText(text);
  const probability = numberValue(record.probability);
  const value = Math.round(numberValue(record.valueAmount));
  const openTasks = numberValue(record.openTaskCount);
  const expectedDate = dateValue(record.expectedCloseDate);
  const latestActivity = dateValue(record.latestActivityAt);
  const daysToBooking = expectedDate ? daysBetween(now, expectedDate) : null;
  const staleDays = latestActivity ? daysBetween(latestActivity, now) : null;

  if (record.status === "lost") scores.win_back += 3;
  if (!expectedDate && record.status !== "won") scores.fill_capacity += 2;
  if (daysToBooking !== null && daysToBooking <= 5 && probability < 55)
    scores.reduce_no_show += 3;
  if (probability > 0 && probability < 45 && value > 0)
    scores.protect_booking += 2;
  if (staleDays !== null && staleDays > 45) scores.win_back += 2;
  if (openTasks > 0) scores.follow_up += Math.min(3, openTasks);
  if (value >= 500) scores.protect_booking += 1;

  const primaryIntent = ORDERED_INTENTS.reduce(
    (best, intent) => (scores[intent] > scores[best] ? intent : best),
    "follow_up" as RecoveryIntentId,
  );
  return { primaryIntent };
}

function scoreText(text: string): Record<RecoveryIntentId, number> {
  const normalized = normalize(text);
  const scores = Object.fromEntries(
    ORDERED_INTENTS.map((intent) => [intent, 0]),
  ) as Record<RecoveryIntentId, number>;
  for (const intent of ORDERED_INTENTS) {
    for (const term of INTENTS[intent]) {
      if (normalized.includes(term))
        scores[intent] += term.includes(" ") ? 2 : 1;
    }
  }
  if (scores.follow_up === 0) scores.follow_up = 1;
  return scores;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function dateValue(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / 86_400_000);
}

function normalize(value: string) {
  return clean(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\bAI\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
