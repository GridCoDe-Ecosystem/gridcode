---
title: "StoreVault Engine — Formal Invariant Contract"
version: v1.0
status: Implementation Binding
domain: Store
layer: Engine Invariant Boundary
environment: Gridnet OS
authoritative: true
---

# StoreVault Engine — Formal Invariant Contract

This defines what MUST always be true.

If any invariant is broken, Store v1 is compromised.

## 1. State Invariants

### 1. Valid States Only

`listing.state` MUST always be one of:

- `LISTED`
- `PURCHASED`
- `FULFILLED`
- `DISPUTED`
- `CANCELLED`

No implicit states. No undefined states. No soft states.

### 2. State ↔ Field Consistency

```
state === LISTED     → buyerId MUST be null
state === PURCHASED  → buyerId MUST NOT be null
state === FULFILLED  → settlementDeadline MUST exist
state === DISPUTED   → disputeRecord MUST NOT be null
state === CANCELLED  → settlementFinalized MUST be false
```

No partial transitions allowed.

### 3. settlementFinalized Lock

If `settlementFinalized === true`, then:

- `state` MUST be `FULFILLED`
- `disputeRecord` MUST be null
- No further state transitions allowed

Settlement finalization is terminal.

## 2. Identity Invariants

### 4. Seller Binding

All SELLER actions require:

```
actorId === listing.sellerId
```

### 5. Buyer Binding

After purchase, all BUYER actions require:

```
actorId === listing.buyerId
```

### 6. Dispute Authority

Only the assigned buyer may raise a dispute.

### 7. SYSTEM Authority

Only SYSTEM may execute:

- `AUTO_CANCEL_TIMEOUT`
- `RESOLVE_SELLER`
- `RESOLVE_BUYER`
- `FINALIZE_SETTLEMENT`

## 3. Economic Invariants

### 8. Minimum Listing Price

Purchase MUST reject:

```
price < minListingPriceGNC
```

`minListingPriceGNC` = 10 GNC (committed).

### 9. Auto Cancel Window

`AUTO_CANCEL` is only valid when:

```
timestamp ≥ purchaseTimestamp + fulfillmentWindowMs
```

`fulfillmentWindowMs` = 48h (committed).

### 10. Dispute Window

Dispute is valid only if:

```
timestamp < settlementDeadline
```

Strict less-than.

### 11. Settlement Finalization Boundary

`FINALIZE_SETTLEMENT` is valid only if:

```
timestamp ≥ settlementDeadline
```

Strict greater-or-equal.

### 12. Base Delta Exclusivity

Only the following actions MAY emit reputation deltas:

- `AUTO_CANCEL_TIMEOUT`
- `RESOLVE_SELLER`
- `RESOLVE_BUYER`
- `FINALIZE_SETTLEMENT`

No other transition may emit deltas.

## 4. Determinism Invariants

### 13. No Time Fetching

Engine MUST NOT call system time. Timestamp MUST be injected.

### 14. No Mutation

Input aggregate MUST remain unchanged.

### 15. Pure Function

Given identical inputs:

- `listing`
- `actorId`
- `role`
- `action`
- `timestamp`
- `params`
- `flags`

Output MUST be identical.

### 16. Receipt Monotonicity

Each successful state transition MUST append exactly one receipt.

No duplicate receipts. No silent transitions.

## 5. Security Invariants

### 17. Single Active Dispute

`listing.disputeRecord` MUST be null unless `state === DISPUTED`.

### 18. Single Active Buyer

`listing.buyerId` MUST be assigned exactly once.

### 19. Replay Resistance

If an action is invalid for the current state, the engine MUST:

- Return the original listing unchanged
- Emit no deltas
- Append no receipts

### 20. No Hidden Transitions

Engine MUST NOT:

- Modify fields unrelated to the action
- Inject hidden side effects

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

**Canonical Status:** Implementation Binding — Frozen
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/engine/store-simulation-engine-v1.0.md`
- `/docs/engine/store-protocol-v1.0.md`
- `/docs/engine/store-adapter-invariant-contract-v1.0.md`
