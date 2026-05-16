export class RewardsEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewardsEngineError";
  }
}

export class UserHasNoActiveCardsError extends RewardsEngineError {
  constructor(userId: string) {
    super(`User ${userId} has no active cards in their wallet.`);
    this.name = "UserHasNoActiveCardsError";
  }
}

export class InvalidPurchaseAmountError extends RewardsEngineError {
  constructor(amountCents: number) {
    super(`Invalid purchase amount: ${amountCents}. Amount must be positive.`);
    this.name = "InvalidPurchaseAmountError";
  }
}

export class MerchantNotFoundError extends RewardsEngineError {
  constructor(merchantId: string) {
    super(`Merchant ${merchantId} could not be found.`);
    this.name = "MerchantNotFoundError";
  }
}

export class NoEligibleEarningRulesError extends RewardsEngineError {
  constructor() {
    super("No eligible earning rules matched any active user card.");
    this.name = "NoEligibleEarningRulesError";
  }
}
