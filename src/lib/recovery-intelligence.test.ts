import { describe, expect, it } from "vitest";
import { classifyRecoveryIntent } from "./recovery-intelligence";

const now = new Date("2026-06-13T12:00:00Z");

describe("recovery intelligence", () => {
  it("classifies sales records into actionable intents", () => {
    expect(
      classifyRecoveryIntent(
        {
          id: "a",
          title: "Retail lead needs demo follow up",
          status: "open",
          valueAmount: 180,
          probability: 70,
        },
        now,
      ),
    ).toBe("rebook");

    expect(
      classifyRecoveryIntent(
        {
          id: "b",
          title: "Friday decision tentative, confirm timeline",
          status: "open",
          valueAmount: 220,
          probability: 30,
          expectedCloseDate: "2026-06-15",
        },
        now,
      ),
    ).toBe("reduce_no_show");
  });
});
