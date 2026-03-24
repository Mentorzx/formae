import type {
  ClockTime,
  ScheduleMeeting,
  TurnCode,
  Weekday,
} from "@formae/protocol";

const weekdayLabels: Record<Weekday, string> = {
  monday: "Segunda",
  tuesday: "Terca",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sabado",
};

const turnLabels: Record<TurnCode, string> = {
  morning: "Manha",
  afternoon: "Tarde",
  night: "Noite",
};

export function formatClockTime(clockTime: ClockTime): string {
  return `${String(clockTime.hour).padStart(2, "0")}:${String(clockTime.minute).padStart(2, "0")}`;
}

export function formatTurn(turn: TurnCode): string {
  return turnLabels[turn];
}

export function formatWeekday(weekday: Weekday): string {
  return weekdayLabels[weekday];
}

export function formatMeeting(meeting: ScheduleMeeting): string {
  return `${formatWeekday(meeting.day)}, ${formatClockTime(meeting.startTime)}-${formatClockTime(meeting.endTime)} (${formatTurn(meeting.turn)})`;
}
