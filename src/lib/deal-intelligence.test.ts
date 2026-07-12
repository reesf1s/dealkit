import { describe, expect, it } from "vitest";
import { predictDeals, trainDealModel } from "@/lib/deal-intelligence";
import type { CrmLeadDto } from "@/lib/sme-crm";

function lead(overrides: Partial<CrmLeadDto> = {}): CrmLeadDto {
  return {
    id: "deal-1",
    title: "Acme",
    companyName: "Acme",
    primaryPersonName: "Alex",
    owner: "Sam",
    score: 70,
    status: "open",
    stage: "Proposal",
    stageName: "Proposal",
    description: "Active evaluation",
    nextStep: "Book decision call",
    valueAmount: 20000,
    probability: 60,
    latestActivityAt: new Date().toISOString(),
    openTaskCount: 1,
    channel: "mail",
    risk: "warm",
    notes: "",
    ...overrides,
  };
}

describe("deal intelligence", () => {
  it("uses the prior when a workspace lacks enough closed outcomes", () => {
    expect(trainDealModel([lead()]).trained).toBe(false);
  });

  it("prioritises a buyer reply as the next action", () => {
    const result = predictDeals({
      leads: [lead()],
      messages: [
        {
          id: "m1",
          leadId: "deal-1",
          channel: "mail",
          from: "customer",
          text: "Can we talk?",
          time: "10:00",
          sentAt: new Date().toISOString(),
        },
      ],
    });
    expect(result.predictions["deal-1"].nextAction.type).toBe("reply");
    expect(result.predictions["deal-1"].signals).toContain(
      "Buyer is waiting for a reply",
    );
  });

  it("flags stale deals as high risk", () => {
    const result = predictDeals({
      leads: [lead({ latestActivityAt: "2026-01-01T00:00:00.000Z" })],
      messages: [],
    });
    expect(result.predictions["deal-1"].risk).toBe("high");
  });
});
