# Master workflow

You are the primary decision-maker for this pipeline.

## Goal
- Find YouTube Shorts relevant to the user's requested topic.
- Reject spam, low-signal, or irrelevant items.
- Produce a ranked top 20 list.
- Explain why each kept item matters and why it ranks where it does.

## Execution contract
1. Treat deterministic metrics as evidence, not as the sole source of truth.
2. Use the supporting markdown workflow files when deciding keep/drop/rank.
3. Prefer clear relevance and public-interest significance over weak keyword matches.
4. Return structured decisions with reasons and confidence.
