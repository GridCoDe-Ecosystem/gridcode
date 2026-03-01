---
title: GridCoDe Reputation Index (RI) — Canonical Range Definition
version: v1.0
status: Active Binding
domain: Core
layer: Reputation Governance
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/identity/reputation-stake-governance-v1.0.md
last_reviewed: 2026-02
---

# GridCoDe Reputation Index (RI) — Canonical Range Definition

## 1. Core Design Goals (Non-Negotiable)

The RI range must:

- Feel human-scale
- Move slowly
- Reward consistency, not bursts
- Remain legible in UI without charts
- Avoid gamification
- Avoid credit-score mimicry
- Survive future rescaling without breaking UX

Any range that violates these is wrong for GridCoDe.

## 2. Canonical RI Range

✅ 0–100 (locked)

This is the recommended and canonical range.

## 3. Meaning of the Range (Semantics, not math)

| RI Band | Canonical Meaning |
|---|---|
| 0–19 | Untrusted / New / Restricted |
| 20–39 | Low Trust / Limited Participation |
| 40–59 | Established / Normal Participant |
| 60–79 | High Trust / Reliable |
| 80–100 | Exceptional / System-Trusted |

Important: These are interpretive bands, not tiers, badges, or labels.

They:

- do not appear explicitly in UI
- do not imply permanence
- do not auto-unlock everything

They simply help designers, reviewers, and governance reason about RI.

## 4. Starting Values (Important for Onboarding)

To avoid "everyone starts at zero" stigma:

**Default new Citizen RI: 25**

Enough to participate. Not enough to sponsor, lend, or dominate.

This avoids:

- cold-start paralysis
- fake inflation
- sybil abuse via zero-weight spam

## 5. How RI Changes (High-Level, Non-Numeric)

We intentionally do not define formulas here, but we do define directionality.

RI increases via:

- completed epochs
- successful receipts
- fulfilled obligations
- dispute-free participation
- role-appropriate behavior

RI decreases via:

- failed commitments
- disputes upheld against the user
- defaults
- slashing events (if applicable later)

RI does not:

- change rapidly
- spike from single actions
- grow exponentially
- reset on grid transfer

This preserves trust semantics.

## 6. UI Rules (Binding)

With a 0–100 range, the Citizen Overview must:

✅ Show RI as:

```
RI: 72
High Reliability
```

❌ Must never show:

- decimals
- deltas (+3, −1)
- charts
- progress bars
- "next level" indicators

RI is state, not progression.

## 7. Why 0–100 Beats Every Alternative

**Why not 0–1000 / 850?**

- feels like credit scoring
- invites gaming
- encourages number watching
- breaks meaning per point

**Why not unbounded?**

- destroys UX legibility
- forces normalization everywhere
- impossible to explain to users

**Why not role-specific separate numbers?**

- fragments identity
- complicates UI
- harder to reason about trust holistically

You can still have role-weighted effects internally without multiple RI numbers.

## 8. Future-Proofing (Critical)

If you ever need to rescale later:

- UI never promises "out of 100"
- UI says "Reputation Index", not "Score"
- Descriptors carry meaning, not the absolute number

That means you can:

- remap internally
- compress or stretch
- introduce governance modifiers

...without breaking user mental models.

## 9. Canonical Decision Summary

✅ RI range: 0–100

✅ Default start: ~25

✅ Slow-moving, receipt-driven

❌ No tiers (Gold, Silver, etc.)

❌ No credit-score semantics

❌ No gamified progression

This is fully aligned with: identity-first design, reputation as trust (not XP), and GridCoDe's long-term governance path.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/identity/reputation-stake-governance-v1.0.md`
