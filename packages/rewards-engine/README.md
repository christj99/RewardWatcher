# Rewards Engine

Deterministic v0 recommendation engine for ranking cards in a user's wallet.

The engine is data-driven from repository-provided cards, earning rules, merchant/category assumptions, currency valuations, caps, and user preferences. It does not call an LLM, does not write `RecommendationEvent` records, and does not expose API routes. API persistence and integration come in later phases.

Confidence handling is conservative: low-confidence or unknown material inputs cap the output confidence, activation-required rules are downgraded, and caps fall back to base rules when exhausted.
