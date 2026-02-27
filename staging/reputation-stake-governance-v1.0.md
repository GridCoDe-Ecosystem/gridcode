---
title: "GridCoDe Reputation & Stake Governance Specification"
version: v1.0
status: Implementation Binding
domain: Governance
layer: Core Economic Governance
scope: "All Vault FSMs (Store, Trade, Lending, Challenge, Service, Future Vaults)"
authoritative: true
---

# GridCoDe Reputation & Stake Governance Specification

**Status:** Implementation Binding

**Scope:** All Vault FSMs (Store, Trade, Lending, Challenge, Service, Future Vaults)

**Layer:** Core Economic Governance

**Supersedes:** None

**Dependencies:**

- RI Canonical Range Definition (0–100)
- Store v1 Economic Parameter Registry

## 0. Purpose

This document defines the unified governance layer governing:

- Reputation (RI) behavior
- Reputation velocity scaling
- Stake requirements
- Stake slashing
- Stake–Reputation coupling
- High-risk Vault access gating

This specification applies system-wide and is not application-specific.

## 1. Reputation Model

### 1.1 Canonical Range

- RI range: 0–100
- Default starting RI: 25
- Integer display only
- No tiers displayed in UI
- No gamification indicators
- No decimals exposed

100 is a theoretical ceiling.

### 1.2 Global Identity Rule

There is one global RI per participant identity.

- No role-specific RI
- No compartmentalized scores
- No cross-role isolation

All behavior affects the same identity-bound RI.

## 2. Reputation Velocity Curve

RI movement is zone-dependent.

Negative deltas are NEVER friction-reduced.

### 2.1 Zone A — Bootstrap Zone (0–60)

- Positive multiplier: ×1.0
- Negative multiplier: ×1.0

Linear growth allowed.

Purpose:

- Avoid cold-start paralysis.
- Allow rapid establishment of trust.

### 2.2 Zone B — Reliability Zone (60–70)

- Positive multiplier: ×0.5
- Negative multiplier: ×1.0

Trust growth slows.

Penalties remain full.

### 2.3 Zone C — High Trust Zone (70–80)

- Positive multiplier: ×0.25
- Negative multiplier: ×1.0

Elite consolidation begins.

### 2.4 Zone D — Exceptional Zone (80–99)

- Positive multiplier: ×0.1
- Negative multiplier: ×1.0

Movement becomes extremely slow.

Penalties remain full strength.

### 2.5 100 Ceiling Rule

- RI SHALL NOT exceed 100.
- Positive deltas at 100 are ignored.
- Negative deltas may reduce RI from 100.

### 2.6 Fractional Accumulation

Internally:

- Fractional deltas MAY accumulate.
- UI SHALL display only integers.
- Internal buffer resets when integer threshold crossed.

### 2.7 No Permanent Privilege

If RI drops below a zone threshold:

- New multiplier applies immediately.
- No grandfathering.
- No elite immunity.

Trust must be maintained.

## 3. Reputation Engine Interface

Vault FSMs MUST return only baseDelta.

Vault FSMs MUST NOT emit baseDelta until `settlementFinalized = true`. Any baseDelta produced before settlement finality MUST be held or discarded — never applied to RI prematurely.

Reputation Engine applies velocity scaling.

### 3.1 Core Structure

```
ReputationState {
  participantId
  currentRI (0–100)
  internalBuffer (fractional)
  lastUpdated
}
```

### 3.2 Deterministic Application Rule

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

## 4. Trust–Stake Dual Gate Model

High-risk Vault access requires:

```
Eligibility = (RI ≥ threshold) AND (Stake ≥ minimum)
```

Neither condition alone is sufficient.

### 4.1 RI Purpose

Measures historical behavioral reliability.

### 4.2 Stake Purpose

Represents contextual economic commitment.

- Locked
- Time-bound
- Exposure-scoped
- Deterministically slashable

## 5. Grid-Scoped Stake Model

Stake MUST be locked within the same Grid as the economic action.

Not global. Not cross-grid. Not external.

Each Grid is an isolated economic domain.

Failure in one Grid does not propagate to others.

## 6. Stake–Reputation Coupling Rule

When stake is slashed due to deterministic rule violation:

```
StakeLoss ⇒ ReputationPenalty
```

Economic loss MUST produce behavioral consequence.

Slashing events MUST produce a deterministic baseDelta defined by the fault category in Section 7. The Vault FSM determines the fault category and emits the corresponding baseDelta. The Reputation Engine then applies velocity scaling to that delta using the same rules as any other baseDelta. No separate slashing penalty path exists — all RI consequences flow through the unified baseDelta interface.

## 7. Slashing Categories (Fixed Penalty Model)

Penalties are fixed by category.

They are NOT proportional to exposure size.

### 7.1 Minor Fault

Examples: operational lapse, missed response window.

Penalty:

- Stake: partial slash
- RI: −2 (baseDelta)

### 7.2 Major Fault

Examples: contract breach, deterministic default, verified failure to deliver.

Penalty:

- Stake: significant slash
- RI: −4 (baseDelta)

### 7.3 Malicious Behavior

Examples: exploit attempt, coordinated manipulation, repeated deterministic violations.

Penalty:

- Stake: maximum slash
- RI: −6 (baseDelta)

### 7.4 Velocity Interaction

Negative deltas:

- Are NEVER friction-reduced
- Apply fully regardless of RI zone
- May cause immediate zone downgrade

Elite trust is fragile under misconduct.

## 8. Anti-Gaming Guarantees

This governance layer prevents:

- Role-based reputation farming
- Wealth-based immunity
- Exposure-based distortion
- Micro-transaction farming
- Cross-grid contamination
- Trust compartmentalization

Trust remains: identity-bound, behavior-driven, economically reinforced.

## 9. Store v1 Compatibility

This governance layer integrates directly with:

- Store v1 Economic Parameter Registry
- StoreVault FSM
- Dispute resolution rules
- NFT mint trigger timing

No contradictions exist.

## 10. Architectural Separation

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

## 11. Stability Declaration

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

**Canonical Status:** Implementation Binding — Frozen
**Document Tier:** Tier 1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/governance/ri-range-definition.md`
- `/docs/governance/subid-role-spec-v1.2.md`
