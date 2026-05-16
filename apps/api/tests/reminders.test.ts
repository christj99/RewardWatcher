import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("reminders API", () => {
  it("creates, lists, completes, and dismisses current-user reminders", async () => {
    const server = await buildSeededServer();
    const beta = await betaUser();
    await prisma.reminder.deleteMany({ where: { userId: beta.id } });

    const created = await server.inject({
      method: "POST",
      url: "/v1/reminders",
      payload: {
        reminderType: "CUSTOM",
        title: "Check retention offer",
        dueAt: "2500-01-01T00:00:00.000Z",
      },
    });
    const reminderId = created.json().id;
    const listed = await server.inject({ method: "GET", url: "/v1/reminders" });
    const completed = await server.inject({
      method: "PATCH",
      url: `/v1/reminders/${reminderId}`,
      payload: { status: "COMPLETED" },
    });
    const dismissed = await server.inject({
      method: "DELETE",
      url: `/v1/reminders/${reminderId}`,
    });

    expect(created.statusCode).toBe(201);
    expect(listed.json().map((item: { id: string }) => item.id)).toContain(
      reminderId,
    );
    expect(completed.json().completedAt).toBeTruthy();
    expect(dismissed.json().status).toBe("DISMISSED");

    await server.close();
  });

  it("validates user card ownership and protects another user's reminder", async () => {
    const server = await buildSeededServer();
    const adminCard = await userCardFor("admin@example.com", "amex-gold");
    const adminReminder = await prisma.reminder.create({
      data: {
        userId: adminCard.userId,
        userCardId: adminCard.id,
        reminderType: "CUSTOM",
        title: "Admin reminder",
        dueAt: new Date("2500-01-01T00:00:00.000Z"),
      },
    });

    const invalidCard = await server.inject({
      method: "POST",
      url: "/v1/reminders",
      payload: {
        userCardId: adminCard.id,
        reminderType: "CUSTOM",
        title: "Bad card",
        dueAt: "2500-01-01T00:00:00.000Z",
      },
    });
    const otherReminder = await server.inject({
      method: "PATCH",
      url: `/v1/reminders/${adminReminder.id}`,
      payload: { status: "COMPLETED" },
    });

    expect(invalidCard.statusCode).toBe(404);
    expect(otherReminder.statusCode).toBe(404);

    await server.close();
  });

  it("generates annual fee, welcome bonus, and statement credit reminders idempotently", async () => {
    const server = await buildSeededServer();
    const email = "phase12-reminders@example.com";
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, displayName: "Phase 12 Reminders" },
    });
    const headers = { "x-user-email": email };
    const userCard = await isolatedReminderUserCard(email);
    await prisma.reminder.deleteMany({ where: { userId: user.id } });
    await prisma.userCard.update({
      where: { id: userCard.id },
      data: {
        annualFeeDueMonth: 6,
        welcomeBonusDeadline: new Date("2500-06-15T00:00:00.000Z"),
      },
    });

    const first = await server.inject({
      method: "POST",
      url: "/v1/reminders/generate-defaults",
      headers,
      payload: {},
    });
    const second = await server.inject({
      method: "POST",
      url: "/v1/reminders/generate-defaults",
      headers,
      payload: {},
    });
    const overwrite = await server.inject({
      method: "POST",
      url: "/v1/reminders/generate-defaults",
      headers,
      payload: { overwriteExisting: true },
    });
    const types = first
      .json()
      .reminders.map((item: { reminderType: string }) => item.reminderType);

    expect(first.statusCode).toBe(200);
    expect(types).toContain("ANNUAL_FEE");
    expect(types).toContain("WELCOME_BONUS_DEADLINE");
    expect(types).toContain("STATEMENT_CREDIT");
    expect(second.json().createdCount).toBe(0);
    expect(second.json().skippedCount).toBeGreaterThan(0);
    expect(overwrite.json().updatedCount).toBeGreaterThan(0);

    await server.close();
  });
});

async function betaUser() {
  return prisma.user.findUniqueOrThrow({
    where: { email: "beta@example.com" },
  });
}

async function userCardFor(email: string, cardSlug: string) {
  const [user, card] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email } }),
    prisma.card.findUniqueOrThrow({ where: { slug: cardSlug } }),
  ]);
  return prisma.userCard.upsert({
    where: { userId_cardId: { userId: user.id, cardId: card.id } },
    update: { isActive: true },
    create: { userId: user.id, cardId: card.id, isActive: true },
  });
}

async function isolatedReminderUserCard(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.userCard.updateMany({
    where: { userId: user.id },
    data: { isActive: false },
  });

  const issuer = await prisma.issuer.upsert({
    where: { slug: "phase12-reminder-issuer" },
    update: { name: "Phase 12 Reminder Issuer" },
    create: {
      name: "Phase 12 Reminder Issuer",
      slug: "phase12-reminder-issuer",
    },
  });
  const card = await prisma.card.upsert({
    where: { slug: "phase12-reminder-card" },
    update: {
      issuerId: issuer.id,
      name: "Phase 12 Reminder Card",
      isActive: true,
    },
    create: {
      issuerId: issuer.id,
      name: "Phase 12 Reminder Card",
      slug: "phase12-reminder-card",
      isActive: true,
    },
  });
  await prisma.statementCredit.upsert({
    where: { id: "phase12-reminder-credit" },
    update: {
      cardId: card.id,
      name: "Phase 12 Reminder Credit",
      description: "A deterministic test credit.",
      amountCents: 1000,
      recurrence: "MONTHLY",
      category: "DINING",
      confidence: "HIGH",
    },
    create: {
      id: "phase12-reminder-credit",
      cardId: card.id,
      name: "Phase 12 Reminder Credit",
      description: "A deterministic test credit.",
      amountCents: 1000,
      recurrence: "MONTHLY",
      category: "DINING",
      confidence: "HIGH",
    },
  });

  return prisma.userCard.upsert({
    where: { userId_cardId: { userId: user.id, cardId: card.id } },
    update: { isActive: true },
    create: { userId: user.id, cardId: card.id, isActive: true },
  });
}
