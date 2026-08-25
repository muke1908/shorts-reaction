# Design taste for this repository

This project should follow a **minimal, product-focused UI style**.

## Core preferences

1. Keep the interface compact and clean.
2. Prefer subtle status indicators over large banners, oversized loaders, or visually heavy callouts.
3. On functional screens, avoid oversized graphics, giant headings, or anything that competes with the primary task.
4. Keep labels customer-facing and product-oriented instead of technical or internal-sounding.
5. Use clear separation between sections, but do it with restrained visual weight.
6. Default to consistency first: controls, spacing, and emphasis should feel uniform across the app.

## Loading and status guidance

1. Loading states should usually be inline, embedded, or corner-anchored.
2. Avoid modal-like loader treatments unless the entire screen is truly blocked.
3. Prefer small spinners, chips, or concise status text over large centered loading cards.
4. Progress messaging should be brief and calm.

## Workflow for future UI changes

Before adding new UI affordances, ask:

- Is this the smallest clear version of the idea?
- Does this feel like a customer product instead of a developer dashboard?
- Is the emphasis proportional to the importance of the action or state?
- Can the same meaning be expressed with less visual noise?

When in doubt, choose the more minimal option.
