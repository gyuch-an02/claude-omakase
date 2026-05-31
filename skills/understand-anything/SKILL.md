---
name: understand-anything
description: Deeply explain any code, concept, system, or error in a way that builds genuine understanding. Use when user wants to understand something rather than just fix it.
triggers: ["explain this", "help me understand", "how does this work", "what does this mean", "walk me through"]
---

# Understand Anything

When the user wants to understand something — code, a concept, an error, a system — go deep.

## Process

1. **Identify what to explain**: the specific thing the user is confused about.
2. **Find the right level**: ask one clarifying question if needed — "Do you want the 30-second version or the full picture?"
3. **Explain bottom-up**: start with the core intuition (one sentence), then build up. Use analogies from domains the user knows.
4. **Show, don't tell**: for code, annotate key lines. For systems, sketch the flow in ASCII if it helps.
5. **Check understanding**: end with "Does that track? What's still fuzzy?"

## What makes a good explanation

- Lead with WHY before HOW
- Use concrete examples, not abstract definitions
- Name the thing the user was confused about explicitly
- Acknowledge what's genuinely tricky about it

## Don't

- Don't paste documentation verbatim
- Don't explain things the user clearly already knows
- Don't stop at the surface — go one level deeper than they asked
