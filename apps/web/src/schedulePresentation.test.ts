import { formatClockTime, formatMeeting } from "./schedulePresentation";

describe("schedulePresentation", () => {
  it("formats a UFBA clock time with zero padding", () => {
    expect(formatClockTime({ hour: 7, minute: 5 })).toBe("07:05");
  });

  it("formats a meeting in PT-BR labels", () => {
    expect(
      formatMeeting({
        day: "thursday",
        turn: "night",
        slotStart: 1,
        slotEnd: 2,
        startTime: { hour: 18, minute: 30 },
        endTime: { hour: 20, minute: 20 },
        sourceSegment: "35N12",
      }),
    ).toBe("Quinta, 18:30-20:20 (Noite)");
  });
});
