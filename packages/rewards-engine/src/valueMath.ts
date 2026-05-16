import type { DecimalLike } from "./types.js";

const centsPerDollar = 100;

export function decimalToNumber(value: DecimalLike): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid decimal value: ${String(value)}`);
  }

  return parsed;
}

export function centsToDollars(amountCents: number): number {
  return amountCents / centsPerDollar;
}

export function computePointsEarned(
  amountCents: number,
  multiplier: DecimalLike,
): number {
  return centsToDollars(amountCents) * decimalToNumber(multiplier);
}

export function computeValueCents(
  pointsEarned: DecimalLike,
  centsPerPoint: DecimalLike,
): number {
  return decimalToNumber(pointsEarned) * decimalToNumber(centsPerPoint);
}

export function roundValueCents(value: DecimalLike): number {
  return Math.round(decimalToNumber(value));
}

export function compareValueCents(a: DecimalLike, b: DecimalLike): number {
  return decimalToNumber(a) - decimalToNumber(b);
}

export function computeExpectedValueCents(
  amountCents: number,
  multiplier: DecimalLike,
  centsPerPoint: DecimalLike,
): { points: number; valueCents: number } {
  // Cashback is treated as a points-like currency in the seed data: 6x at
  // 1 cent per point on $100 earns 600 units worth 600 cents.
  const points = computePointsEarned(amountCents, multiplier);
  return {
    points,
    valueCents: roundValueCents(computeValueCents(points, centsPerPoint)),
  };
}
