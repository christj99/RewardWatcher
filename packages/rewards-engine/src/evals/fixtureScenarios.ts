export type EvalFixtureScenario = {
  email: string;
  displayName: string;
  description: string;
};

export const EVAL_FIXTURE_USERS: EvalFixtureScenario[] = [
  {
    email: "eval-pass-1@example.com",
    displayName: "Eval Pass One",
    description: "Meaningful missed value with low recommendation errors.",
  },
  {
    email: "eval-pass-2@example.com",
    displayName: "Eval Pass Two",
    description: "Multiple meaningful user misses.",
  },
  {
    email: "eval-pass-3@example.com",
    displayName: "Eval Pass Three",
    description: "Meaningful missed value above annual subscription price.",
  },
  {
    email: "eval-low-value@example.com",
    displayName: "Eval Low Value",
    description: "Tiny misses and captured optimal outcomes.",
  },
  {
    email: "eval-error-heavy@example.com",
    displayName: "Eval Error Heavy",
    description: "Recommendation errors for trust-gate testing.",
  },
  {
    email: "eval-inconclusive@example.com",
    displayName: "Eval Inconclusive",
    description: "Inconclusive outcomes for data-completeness testing.",
  },
];

export const EVAL_FIXTURE_EMAILS = EVAL_FIXTURE_USERS.map(
  (scenario) => scenario.email,
);
