---
title: GridCoDe Store Adapter — Formal Invariant Contract
version: v1.0
status: Active Binding
domain: Engine
layer: Adapter Enforcement
tier: Tier-2
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/store/store-v1-protocol-spec-v1.0.md
  - /docs/store/storevault-simulation-engine-v1.0.md
  - /docs/identity/subid-role-technical-spec-v1.2.md
  - /docs/identity/reputation-stake-governance-v1.0.md
last_reviewed: 2026-02
---

# GridCoDe Store Adapter — Formal Invariant Contract

This document defines what the Store Adapter MUST always guarantee. These invariants are binding on all adapter implementations. Violation of any invariant constitutes a protocol breach.

## I. Identity & Role Invariants

### I.1 Actor Identity Source

`actorId` MUST be derived from the SubID registry. It MUST NOT come from UI input, query parameters, or any client-supplied string.

Canonical derivation path:

```
CVMContext → SubID → Adapter
```

### I.2 Role Resolution Rule

Role MUST be computed by the adapter, not trusted from any external source.

```
if actorId === listing.sellerId  → SELLER
if actorId === listing.buyerId   → BUYER
if privileged adapter context    → SYSTEM
else                             → reject
```

Role MUST NOT be passed from UI.

### I.3 SYSTEM Authority Restriction

SYSTEM actions MUST NOT be callable directly from UI. SYSTEM may be triggered by: admin tooling (v1), a deterministic scheduler, or future contract logic only.

## II. Economic Parameter Invariants

### II.1 Parameter Source

Economic parameters MUST be loaded from the governance-controlled config:

```
/gridcode/config/economic_params.json
```

### II.2 Parameter Integrity

Parameters MUST be: governance-controlled, hash-verified, not writable by end users, and not editable via UI.

### II.3 Parameter Injection Rule

The engine MUST receive parameters as injected arguments. The engine MUST never fetch parameters itself.

## III. Timestamp Invariants

### III.1 Timestamp Source

Timestamp MUST come from a block time abstraction or CVMContext-provided deterministic clock. `Date.now()` and any wall-clock source are prohibited.

### III.2 Timeout Determinism

`FINALIZE_SETTLEMENT` MUST use a consistent timestamp source throughout execution. Mixing wall-clock and block-clock is prohibited.

## IV. State Persistence Invariants

### IV.1 Atomic Write Rule

If the engine returns success, the adapter MUST atomically persist: updated listing, receipt, and reputation deltas — as one logical operation. Partial writes are prohibited.

### IV.2 No Write on Error

If the engine returns errors: the listing MUST remain unchanged, no receipt MUST be written, and no reputation update MUST occur.

## V. Reputation Synchronisation Invariants

### V.1 Delta Application Source of Truth

Reputation deltas MUST come exclusively from `result.reputationDeltas`. The adapter MUST NOT invent or modify deltas.

### V.2 Velocity Scaling Separation

The adapter MUST pass `baseDelta` to the Reputation Engine. The Store engine MUST never apply velocity scaling. Scaling belongs exclusively to the Reputation Engine layer.

## VI. Blockchain Anchoring Invariants

### VI.1 txid Attachment Timing

`txid` and `blockHeight` MAY only be attached to a receipt after successful commit. Pre-commit attachment is prohibited.

### VI.2 Receipt Immutability

Once a receipt is written, it MUST NOT be edited. The only permitted post-write operation is appending chain metadata (`txid`, `blockHeight`).

## VII. Error Handling Invariants

### VII.1 Deterministic Error Reporting

The adapter MUST propagate engine errors exactly as returned. Silent error suppression is prohibited.

### VII.2 No UI-Side Business Logic

The UI MUST NOT replicate engine logic. All state transitions MUST pass through the engine. No transition may be applied directly by the UI layer.

## VIII. Freeze Declaration

When all invariants above hold:

- Engine integrity remains intact
- Economic law remains deterministic
- Identity spoofing is impossible
- Parameter tampering is bounded
- Timeout logic is consistent
- Reputation remains synchronised

These invariants are frozen alongside the engine invariants. Together they form the complete implementation enforcement boundary for Store v1.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-2 — Implementation Enforcement
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/store/store-v1-protocol-spec-v1.0.md`
- `/docs/store/storevault-simulation-engine-v1.0.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/identity/reputation-stake-governance-v1.0.md`
