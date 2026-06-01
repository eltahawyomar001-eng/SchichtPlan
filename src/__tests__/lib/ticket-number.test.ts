/**
 * @vitest-environment node
 *
 * Tests for the ticket number generator.
 *
 * Ticket numbers follow the format TK-YYYY-NNNN (zero-padded to 4 digits).
 * The generator queries the workspace's latest ticket for the current year
 * and increments, with retry logic for race conditions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTicketFindFirst, mockTicketCreate } = vi.hoisted(() => ({
  mockTicketFindFirst: vi.fn(),
  mockTicketCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    ticket: {
      findFirst: mockTicketFindFirst,
      create: mockTicketCreate,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    withRequestId: vi.fn(() => ({
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

import {
  generateTicketNumber,
  createTicketWithNumber,
} from "@/lib/ticket-number";

describe("generateTicketNumber", () => {
  const year = new Date().getFullYear();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts at TK-YYYY-0001 when no tickets exist", async () => {
    mockTicketFindFirst.mockResolvedValue(null);
    const number = await generateTicketNumber("ws-1");
    expect(number).toBe(`TK-${year}-0001`);
  });

  it("increments from the last existing number", async () => {
    mockTicketFindFirst.mockResolvedValue({
      ticketNumber: `TK-${year}-0003`,
    });
    const number = await generateTicketNumber("ws-1");
    expect(number).toBe(`TK-${year}-0004`);
  });

  it("zero-pads to 4 digits", async () => {
    mockTicketFindFirst.mockResolvedValue({
      ticketNumber: `TK-${year}-0009`,
    });
    const number = await generateTicketNumber("ws-1");
    expect(number).toBe(`TK-${year}-0010`);
  });

  it("handles 4-digit ticket numbers (no padding needed)", async () => {
    mockTicketFindFirst.mockResolvedValue({
      ticketNumber: `TK-${year}-9999`,
    });
    const number = await generateTicketNumber("ws-1");
    expect(number).toBe(`TK-${year}-10000`);
  });

  it("queries the workspace scope and current year", async () => {
    mockTicketFindFirst.mockResolvedValue(null);
    await generateTicketNumber("ws-abc");
    expect(mockTicketFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "ws-abc",
          ticketNumber: { startsWith: `TK-${year}-` },
        }),
      }),
    );
  });
});

describe("createTicketWithNumber", () => {
  const year = new Date().getFullYear();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ticket with an auto-generated number", async () => {
    mockTicketFindFirst.mockResolvedValue(null); // no existing tickets
    const created = {
      id: "t-1",
      ticketNumber: `TK-${year}-0001`,
      subject: "Test",
      workspaceId: "ws-1",
    };
    mockTicketCreate.mockResolvedValue(created);

    const result = await createTicketWithNumber("ws-1", {
      subject: "Test",
      description: "Desc",
      category: "SONSTIGES",
      priority: "NIEDRIG",
      status: "OFFEN",
      createdById: "user-1",
    });

    expect(mockTicketCreate).toHaveBeenCalledOnce();
    const createArgs = mockTicketCreate.mock.calls[0][0];
    expect(createArgs.data.ticketNumber).toBe(`TK-${year}-0001`);
    expect(createArgs.data.workspaceId).toBe("ws-1");
    expect(result).toEqual(created);
  });

  it("retries on P2002 unique constraint violation (race condition)", async () => {
    mockTicketFindFirst
      .mockResolvedValueOnce({ ticketNumber: `TK-${year}-0001` }) // first attempt: number 0002
      .mockResolvedValueOnce({ ticketNumber: `TK-${year}-0001` }); // second attempt: still 0002

    const uniqueError = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    const created = {
      id: "t-2",
      ticketNumber: `TK-${year}-0002`,
      subject: "Test",
    };
    mockTicketCreate
      .mockRejectedValueOnce(uniqueError) // first attempt fails
      .mockResolvedValueOnce(created); // second attempt succeeds

    const result = await createTicketWithNumber("ws-1", {
      subject: "Test",
      description: "Desc",
      category: "SONSTIGES",
      priority: "NIEDRIG",
      status: "OFFEN",
      createdById: "user-1",
    });

    expect(mockTicketCreate).toHaveBeenCalledTimes(2);
    expect(result).toEqual(created);
  });

  it("throws non-unique errors immediately without retry", async () => {
    mockTicketFindFirst.mockResolvedValue(null);
    const dbError = new Error("Connection refused");
    mockTicketCreate.mockRejectedValue(dbError);

    await expect(
      createTicketWithNumber("ws-1", {
        subject: "Test",
        description: "Desc",
        category: "SONSTIGES",
        priority: "NIEDRIG",
        status: "OFFEN",
        createdById: "user-1",
      }),
    ).rejects.toThrow("Connection refused");

    // Should NOT have retried
    expect(mockTicketCreate).toHaveBeenCalledTimes(1);
  });

  it("passes through select/include options to prisma.create", async () => {
    mockTicketFindFirst.mockResolvedValue(null);
    mockTicketCreate.mockResolvedValue({ id: "t-1", subject: "Test" });

    await createTicketWithNumber(
      "ws-1",
      {
        subject: "Test",
        description: "Desc",
        category: "SONSTIGES",
        priority: "NIEDRIG",
        status: "OFFEN",
        createdById: "user-1",
      },
      { select: { id: true, subject: true } },
    );

    expect(mockTicketCreate.mock.calls[0][0]).toHaveProperty("select", {
      id: true,
      subject: true,
    });
  });
});
