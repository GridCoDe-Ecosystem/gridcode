---
title: StoreVault Engine — Formal Invariant Contract
version: v1.0
status: Active Binding
domain: Engine
layer: Engine Invariant Boundary
tier: Tier-2
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/store/store-v1-protocol-spec-v1.0.md
  - /docs/store/storevault-simulation-engine-v1.0.md
  - /docs/engine/store-adapter-invariant-contract-v1.0.md
last_reviewed: 2026-02
---

# StoreVault Engine — Formal Invariant Contract

This defines what MUST always be true.

If any invariant is broken, Store v1 is compromised.

## 1. State Invariants

### 1.1 Valid States Only

`listing.state` MUST always be one of:

- `LISTED`
- `PURCHASED`
- `FULFILLED`
- `DISPUTED`
- `CANCELLED`

No implicit states. No undefined states. No soft states.

### 1.2 State ↔ Field Consistency

```
state === LISTED     → buyerId MUST be null
state === PURCHASED  → buyerId MUST NOT be null
state === FULFILLED  → settlementDeadline MUST exist
state === DISPUTED   → disputeRecord MUST NOT be null
state === CANCELLED  → settlementFinalized MUST be false
```

No partial transitions allowed.

### 1.3 settlementFinalized Lock

If `settlementFinalized === true`, then:

- No further state transitions are allowed
- This condition is set by `RESOLVE_SELLER`, `RESOLVE_BUYER`, or `FINALIZE_SETTLEMENT`

Settlement finalization is terminal. Once set, all actions are invalid.

## 2. Identity Invariants

### 2.1 Seller Binding

All SELLER actions require:

```
actorId === listing.sellerId
```

### 2.2 Buyer Binding

After purchase, all BUYER actions require:

```
actorId === listing.buyerId
```

### 2.3 Dispute Authority

Only the assigned buyer may raise a dispute.

### 2.4 SYSTEM Authority

Only SYSTEM may execute:

- `RESOLVE_SELLER`
- `RESOLVE_BUYER`
- `FINALIZE_SETTLEMENT`

`AUTO_CANCEL_TIMEOUT` is not implemented in v1. Timeout-based cancellation is deferred to v2.

## 3. Economic Invariants

### 3.1 Minimum Listing Price

Purchase MUST reject:

```
price < minListingPriceGNC
```

`minListingPriceGNC` = 10 GNC (committed).

### 3.2 Fulfillment Window

`fulfillmentWindowMs` = 48h (committed). Enforced by the Adapter layer for liveness monitoring. Does not trigger an in-engine FSM transition in v1.

### 3.3 Dispute Window

Dispute is valid only if:

```
timestamp < settlementDeadline
```

Strict less-than.

### 3.4 Settlement Finalization Boundary

`FINALIZE_SETTLEMENT` is valid only if:

```
timestamp ≥ settlementDeadline
```

Strict greater-or-equal.

### 3.5 Base Delta Exclusivity

Only the following actions MAY emit reputation deltas:

- `RESOLVE_SELLER`
- `RESOLVE_BUYER`
- `FINALIZE_SETTLEMENT`

No other transition may emit deltas.

## 4. Determinism Invariants

### 4.1 No Time Fetching

Engine MUST NOT call system time. Timestamp MUST be injected.

### 4.2 No Mutation

Input aggregate MUST remain unchanged.

### 4.3 Pure Function

Given identical inputs:

- `listing`
- `actorId`
- `action`
- `timestamp`
- `params`
- `flags`

Output MUST be identical. `role` is not an input — it is derived internally from `actorId`.

### 4.4 Receipt Monotonicity

Each successful state transition MUST append exactly one receipt. No duplicate receipts. No silent transitions.

## 5. Security Invariants

### 5.1 Single Active Dispute

`listing.disputeRecord` MUST be null unless `state === DISPUTED`.

### 5.2 Single Active Buyer

`listing.buyerId` MUST be assigned exactly once.

### 5.3 Replay Resistance

If an action is invalid for the current state, the engine MUST:

- Return the original listing unchanged
- Emit no deltas
- Append no receipts

### 5.4 No Hidden Transitions

Engine MUST NOT modify fields unrelated to the action or inject hidden side effects.

## 6. Engine Freeze Declaration

StoreVault Engine v1.0 is hereby declared:

- Identity-bound
- Deterministic
- Economically constrained
- Replay-resistant
- Role-gated
- Boundary-safe

No structural change MAY occur without a version increment to v1.1 or higher.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-2 — Engine Invariant Boundary
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/store/store-v1-protocol-spec-v1.0.md`
- `/docs/store/storevault-simulation-engine-v1.0.md`
- `/docs/engine/store-adapter-invariant-contract-v1.0.md`
