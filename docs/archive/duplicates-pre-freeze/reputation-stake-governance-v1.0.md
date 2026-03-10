---
title: GridCoDe Reputation & Stake Governance Specification
version: v1.0
status: Active Binding
domain: Core
layer: Reputation Governance
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/identity/reputation-index-canonical-range-v1.0.md
  - /docs/identity/subid-role-technical-spec-v1.2.md
last_reviewed: 2026-02
---

# GridCoDe Reputation & Stake Governance Specification

## 1. Purpose

This document defines the unified governance layer governing:

- Reputation (RI) behavior
- Reputation velocity scaling
- Stake requirements
- Stake slashing
- Stake–Reputation coupling
- High-risk Vault access gating

This specification applies system-wide and is not application-specific.

## 2. Reputation Model

### 2.1 Canonical Range

- RI range: 0–100
- Default starting RI: 25
- Integer display only
- No tiers displayed in UI
- No gamification indicators
- No decimals exposed

100 is a theoretical ceiling.

### 2.2 Global Identity Rule

There is one global RI per participant identity.

- No role-specific RI
- No compartmentalized scores
- No cross-role isolation

All behavior affects the same identity-bound RI.

## 3. Reputation Velocity Curve

RI movement is zone-dependent.

Negative deltas are NEVER friction-reduced.

### 3.1 Zone A — Bootstrap Zone (0–60)

- Positive multiplier: ×1.0
- Negative multiplier: ×1.0

Linear growth allowed.

Purpose:

- Avoid cold-start paralysis.
- Allow rapid establishment of trust.

### 3.2 Zone B — Reliability Zone (60–70)

- Positive multiplier: ×0.5
- Negative multiplier: ×1.0

Trust growth slows.

Penalties remain full.

### 3.3 Zone C — High Trust Zone (70–80)

- Positive multiplier: ×0.25
- Negative multiplier: ×1.0

Elite consolidation begins.

### 3.4 Zone D — Exceptional Zone (80–99)

- Positive multiplier: ×0.1
- Negative multiplier: ×1.0

Movement becomes extremely slow.

Penalties remain full strength.

### 3.5 100 Ceiling Rule

- RI SHALL NOT exceed 100.
- Positive deltas at 100 are ignored.
- Negative deltas may reduce RI from 100.

### 3.6 Fractional Accumulation

Internally:

- Fractional deltas MAY accumulate.
- UI SHALL display only integers.
- When a fractional buffer crosses an integer threshold, the integer portion is applied to RI and the sub-integer remainder is retained in the buffer. The buffer does NOT reset to zero — it carries the remainder forward into the next delta.

### 3.7 No Permanent Privilege

If RI drops below a zone threshold:

- New multiplier applies immediately.
- No grandfathering.
- No elite immunity.

Trust must be maintained.

## 4. Reputation Engine Interface

Vault FSMs MUST return only baseDelta.

Vault FSMs MUST NOT emit baseDelta until `settlementFinalized = true`. Any baseDelta produced prior to settlement finality MUST be held in Vault context and MUST NOT be visible to the Reputation Engine. Pre-finality baseDelta that is discarded or cancelled MUST leave no trace in the Reputation Engine state.

Reputation Engine applies velocity scaling.

### 4.1 Core Structure

```
ReputationState {
  participantId
  currentRI (0–100)
  internalBuffer (fractional)
  lastUpdated
}
```

### 4.2 Deterministic Application Rule

```
applyDelta(reputationState, baseDelta)
```

Rules:

- If baseDelta < 0 → no multiplier
- If baseDelta > 0 → apply zone multiplier
- Clamp result to 0–100
- No randomness
- No OS dependency

Given same inputs → same outputs.

## 5. Trust–Stake Dual Gate Model

High-risk Vault access requires:

```
Eligibility = (RI ≥ threshold) AND (Stake ≥ minimum)
```

Neither condition alone is sufficient.

### 5.1 RI Purpose

Measures historical behavioral reliability.

### 5.2 Stake Purpose

Represents contextual economic commitment.

- Locked
- Time-bound
- Exposure-scoped
- Deterministically slashable

## 6. Grid-Scoped Stake Model

Stake MUST be locked within the same Grid as the economic action.

Not global. Not cross-grid. Not external.

Each Grid is an isolated economic domain.

Failure in one Grid does not propagate to others.

## 7. Stake–Reputation Coupling Rule

When stake is slashed due to deterministic rule violation:

```
StakeLoss ⇒ ReputationPenalty
```

Economic loss MUST produce behavioral consequence.

Slashing events MUST produce a deterministic baseDelta defined by the fault category in Section 7. The Vault FSM determines the fault category and emits the corresponding baseDelta. The Reputation Engine then applies velocity scaling to that delta using the same rules as any other baseDelta. No separate slashing penalty path exists — all RI consequences flow through the unified baseDelta interface.

## 8. Slashing Categories (Fixed Penalty Model)

Penalties are fixed by category.

They are NOT proportional to exposure size.

### 8.1 Minor Fault

Examples: operational lapse, missed response window.

Penalty:

- Stake: partial slash
- RI: −2 (baseDelta)

### 8.2 Major Fault

Examples: contract breach, deterministic default, verified failure to deliver.

Penalty:

- Stake: significant slash
- RI: −4 (baseDelta)

### 8.3 Malicious Behavior

Examples: exploit attempt, coordinated manipulation, repeated deterministic violations.

Penalty:

- Stake: maximum slash
- RI: −6 (baseDelta)

### 8.4 Velocity Interaction

Negative deltas:

- Are NEVER friction-reduced
- Apply fully regardless of RI zone
- May cause immediate zone downgrade

Elite trust is fragile under misconduct.

## 9. Anti-Gaming Guarantees

This governance layer prevents:

- Role-based reputation farming
- Wealth-based immunity
- Exposure-based distortion
- Micro-transaction farming
- Cross-grid contamination
- Trust compartmentalization

Trust remains: identity-bound, behavior-driven, economically reinforced.

## 10. Store v1 Compatibility

This governance layer integrates directly with:

- Store v1 Economic Parameter Registry
- StoreVault FSM
- Dispute resolution rules
- NFT mint trigger timing

No contradictions exist.

## 11. Architectural Separation

Layering is strictly preserved:

```
Vault FSM
  → returns baseDelta

Reputation Engine
  → applies velocity scaling

Vault Access Policy
  → checks RI & stake

Stake Logic
  → manages locking & slashing
```

No circular dependencies.

## 12. Stability Declaration

This governance layer is:

- Deterministic
- Modular
- Vault-agnostic
- OS-decoupled
- Anti-inflationary
- Resistant to gaming
- Future-extensible without breaking v1 semantics

## Final Status

Reputation & Stake Governance Specification v1.0 is now frozen.

This layer governs all economic trust behavior in GridCoDe going forward.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/identity/reputation-index-canonical-range-v1.0.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
