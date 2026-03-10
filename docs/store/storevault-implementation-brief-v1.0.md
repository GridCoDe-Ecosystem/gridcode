---
title: GridCoDe StoreVault Engine — Implementation Brief
version: v1.0
status: Active Binding
domain: Store
layer: Engine Implementation Handoff
tier: Tier-2
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/store/store-v1-protocol-spec-v1.0.md
  - /docs/store/storevault-simulation-engine-v1.0.md
  - /docs/engine/storevault-engine-invariant-contract-v1.0.md
  - /docs/engine/store-adapter-invariant-contract-v1.0.md
last_reviewed: 2026-03
---

# GridCoDe StoreVault Engine — Implementation Brief

## 1. Purpose of This Document

This document is an implementation brief for the GridCoDe StoreVault Engine. It translates the frozen specification set into clear, numbered instructions for whoever — human developer or AI coding tool — will produce the actual source files.

It does not replace the canonical specification documents. It packages the agreed architecture, confirmed decisions, and corrections from the design review into a single handoff reference.

Nothing in this brief takes precedence over the frozen spec set. If any instruction here conflicts with the Engine Invariant Contract or the Store v1 Protocol Spec, the spec wins.

## 2. What Is Being Built

The StoreVault Engine is the first engine to be implemented in the GridCoDe v1 build sequence. It is a pure TypeScript state machine that governs commerce transactions between a seller and a buyer within an active StoreGrid.

It handles: listing creation, purchase with escrow confirmation, delivery fulfillment, dispute raising, dispute resolution, and settlement finalization.

It is deliberately minimal. It does not connect to Gridnet OS, the blockchain, any wallet, or any external service. All inputs are injected. All outputs are deterministic. The same inputs always produce the same outputs, with no exceptions.

### 2.1 Responsibility Boundary

| Concern | Who Handles It |
|---|---|
| Connecting to Gridnet OS | Adapter Layer (built later) |
| Wallet interactions | Adapter Layer |
| Timestamp generation | Adapter Layer — injected into engine |
| Liveness monitoring (fulfillment window) | Adapter Layer |
| Receipt chain hash computation | Adapter Layer — previousHash injected |
| Reputation velocity scaling | Reputation Engine (separate) |
| Governance parameter storage | Governance system — params injected |

## 3. File Structure

The Build Guide does not mandate a specific folder layout. The following structure is derived from the logical modules described in the spec and is the agreed starting point.

```
store-v1/
  engine/
    StoreVault.ts       ← single exported function: executeAction()
    transitions.ts      ← private transition functions (not exported)
    guards.ts           ← all invariant guard functions
    types.ts            ← all shared types and enums
    receipts.ts         ← receipt construction and chain verification

  adapter/
    SimAdapter.ts       ← simulation adapter (Phase 2)
    StorageAdapter.ts   ← storage adapter (Phase 2)

  tests/
    store.test.ts       ← standard transition tests
    adversarial.test.ts ← invariant violation tests (AT-1 through AT-14)
```

The `engine/` folder is what gets built first. The `adapter/` and `tests/` folders are Phase 2.

## 4. The State Machine

The StoreVault FSM has five states. It is a directed graph, not a linear chain. Multiple paths lead to DISPUTED and CANCELLED.

```
LISTED
  ├─ PURCHASE ──────────────────────────────→ PURCHASED
  │      ├─ FULFILL ──────────────────────→ FULFILLED
  │      │      ├─ RAISE_DISPUTE ─────────→ DISPUTED
  │      │      │      ├─ RESOLVE_SELLER ─→ FULFILLED (terminal)
  │      │      │      └─ RESOLVE_BUYER ──→ CANCELLED (terminal)
  │      │      └─ FINALIZE_SETTLEMENT ───→ FULFILLED (terminal)
  │      └─ RAISE_DISPUTE ────────────────→ DISPUTED
  └─ CANCEL ───────────────────────────────→ CANCELLED
```

Terminal means no further transitions are possible. Once `settlementFinalized` is set to `true`, every subsequent action is rejected.

### 4.1 Transition Table

| From State | Action | To State | Role Required |
|---|---|---|---|
| LISTED | PURCHASE | PURCHASED | BUYER |
| LISTED | CANCEL | CANCELLED | SELLER |
| PURCHASED | FULFILL | FULFILLED | SELLER |
| PURCHASED | RAISE_DISPUTE | DISPUTED | BUYER |
| FULFILLED | RAISE_DISPUTE | DISPUTED | BUYER |
| FULFILLED | FINALIZE_SETTLEMENT | FULFILLED (terminal) | SYSTEM |
| DISPUTED | RESOLVE_SELLER | FULFILLED (terminal) | SYSTEM |
| DISPUTED | RESOLVE_BUYER | CANCELLED (terminal) | SYSTEM |

Any transition not listed in this table MUST fail. No exceptions.

## 5. The Core Rules

These rules come directly from the Engine Invariant Contract and MUST be enforced without exception.

### 5.1 No time fetching inside the engine

The engine MUST NOT call `Date.now()`, `new Date()`, or any system clock. The timestamp is always injected by the Adapter through `ActionContext`. This is what makes the engine replayable and testable.

### 5.2 Single dispatcher only

`executeAction()` is the only function exported from `StoreVault.ts`. The Adapter always calls `executeAction()`. Individual transition functions are private and are never called directly from outside the engine.

### 5.3 Role is derived internally, never accepted from outside

The engine derives role from `actorId` matched against the listing. If `actorId` matches `sellerId`, the role is SELLER. If it matches `buyerId`, the role is BUYER. If the Adapter has flagged the context as SYSTEM, the role is SYSTEM. Any caller claiming a role they do not hold MUST be rejected before any transition evaluation.

### 5.4 Immutable aggregate

Transition functions MUST NOT mutate the input listing. They return a new listing via spread. `version` increments by 1 on every successful transition. `receiptCount` increments by 1 on every successful transition. A receipt is appended to the receipts array.

### 5.5 Receipt chain integrity

Every receipt includes a `receiptHash` computed as `SHA256(previousHash + canonicalPayload)`. The `previousHash` is computed by the Adapter before calling `executeAction()` and injected through `ActionContext`. The engine MUST NOT compute `previousHash` itself.

### 5.6 Failed transitions return the original listing unchanged

If any guard fails, the engine MUST return the original listing with no changes, no deltas, and an error message. No partial transitions. No silent failures.

### 5.7 Reputation deltas on exactly three actions only

Only `RESOLVE_SELLER`, `RESOLVE_BUYER`, and `FINALIZE_SETTLEMENT` MAY emit reputation deltas. Every other transition MUST return empty deltas. No exceptions.

## 6. Guard Order Inside the Dispatcher

The Build Guide specifies this order as mandatory. It MUST NOT be changed.

| Step | Guard |
|---|---|
| 1 | `guardVersionLock` — checks expectedVersion matches listing.version |
| 2 | `guardTerminalLock` — rejects if settlementFinalized is true |
| 3 | `deriveRole` — resolves actorId to SELLER / BUYER / SYSTEM / UNKNOWN |
| 4 | Routing — switch on action, delegate to transition function |

If any step fails, return immediately. Do not proceed to the next step.

## 7. Guards Required

All guard functions live in `guards.ts`. They return `null` if the check passes, or a descriptive error string if it fails. They are pure functions with no side effects.

| Guard Function | What It Checks |
|---|---|
| `guardVersionLock(listing, expectedVersion)` | `listing.version === expectedVersion` |
| `guardTerminalLock(listing)` | `settlementFinalized !== true` |
| `guardState(current, required)` | current state is in the required set |
| `guardMinPrice(price, params)` | `price >= minListingPriceGNC` (10 GNC) |
| `guardDisputeWindow(timestamp, settlementDeadline)` | `timestamp < settlementDeadline` — passes if deadline is null (PURCHASED state) |
| `guardFinalizationWindow(timestamp, settlementDeadline)` | `timestamp >= settlementDeadline` |
| `guardNoActiveDispute(listing)` | `disputeRecord === null` |
| `guardReceiptCount(listing)` | `receiptCount === receipts.length` — used by Adapter on load, not inside dispatcher |

`guardDisputeWindow` MUST pass when `settlementDeadline` is null. This handles the case where a dispute is raised from PURCHASED state before FULFILL has set the deadline.

`guardReceiptCount` runs at the Adapter boundary on every load. It MUST NOT run inside the dispatcher.

## 8. Resolution Routing Decision

When the incoming action is `RESOLVE_SELLER` or `RESOLVE_BUYER`, the dispatcher MUST ignore the action label and route based on the `evidenceValid` flag in `ActionContext`.

```typescript
if (action === 'RESOLVE_SELLER' || action === 'RESOLVE_BUYER') {
  action = context.evidenceValid === true ? 'RESOLVE_SELLER' : 'RESOLVE_BUYER'
}
```

This prevents a malicious adapter from asserting the wrong resolution direction. The evidence determines the outcome, not the caller's label.

## 9. Reputation Deltas

The following delta values are committed in the frozen spec. The engine emits these as base deltas only. Velocity scaling is handled by the Reputation Engine separately.

| Action | Seller Delta | Buyer Delta |
|---|---|---|
| RESOLVE_SELLER (frivolous dispute by buyer) | +1 | -2 |
| RESOLVE_BUYER (seller failed to deliver) | -4 | +1 |
| FINALIZE_SETTLEMENT (clean completion) | +2 | +1 |
| All other transitions | none | none |

## 10. Economic Parameters

These parameters are injected by the Adapter. The engine MUST NOT hardcode them.

| Parameter | Committed Value | Enforced By |
|---|---|---|
| `minListingPriceGNC` | 10 GNC | Engine — on PURCHASE |
| `fulfillmentWindowMs` | 48 hours | Adapter — liveness monitoring only, not an engine transition |
| `disputeWindowMs` | 24 hours | Engine — sets settlementDeadline on FULFILL; enforced by guardDisputeWindow |

## 11. Validation Checklist

After generating the engine files, run these checks before accepting the output. This list comes from the Build Guide and catches the most common invariant violations.

| Check | Expected Answer |
|---|---|
| Does any function call `Date.now()` or `new Date()`? | NO |
| Does any function call `fetch()` or any async operation? | NO |
| Is role ever accepted as a parameter from outside? | NO |
| Is there any function other than `executeAction()` exported from `StoreVault.ts`? | NO |
| Does any transition function mutate the input listing directly? | NO |
| Does every successful transition increment both `version` AND `receiptCount`? | YES |
| Does the dispatcher run guards in order: version → terminal → role → routing? | YES |
| Does every failed transition return the original listing unchanged? | YES |
| Does PURCHASE check for `escrowTxId` before proceeding? | YES |
| Do only `RESOLVE_SELLER`, `RESOLVE_BUYER`, `FINALIZE_SETTLEMENT` emit deltas? | YES |
| Does `guardDisputeWindow` pass when `settlementDeadline` is null? | YES |
| Does resolution routing normalize action by `evidenceValid`, not action label? | YES |

## 12. Build Sequence

Once the engine is implemented and all validation checks pass, the build sequence continues in this order.

| Phase | What Gets Built |
|---|---|
| Phase 1 (current) | `StoreVault.ts`, `guards.ts`, `types.ts`, `receipts.ts`, `transitions.ts` — pure TypeScript, no OS dependencies |
| Phase 2 | `SimAdapter.ts` — wraps the engine in a simulation context, runs receiptCount verification and chain verification on load |
| Phase 3 | `adversarial.test.ts` — AT-1 through AT-14 covering all invariant violation scenarios |
| Phase 4 | `StorageAdapter.ts` — connects the engine to Gridnet OS (built last, after engine is proven clean) |

The engine MUST be fully proven before the Adapter layer is built. Do not connect to Gridnet OS until the engine passes all adversarial tests.

## 13. Authoritative Sources

This brief is derived from the following canonical documents in the frozen spec set. If anything here conflicts with these sources, the source wins.

- `/docs/engine/storevault-engine-invariant-contract-v1.0.md`
- `/docs/store/store-v1-protocol-spec-v1.0.md`
- `/docs/store/storevault-simulation-engine-v1.0.md`
- `/docs/engine/store-adapter-invariant-contract-v1.0.md`

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-2 — Engine Implementation Handoff
**Last Reviewed:** 2026-03
**Supersedes:** None
**Requires:**
- `/docs/store/store-v1-protocol-spec-v1.0.md`
- `/docs/store/storevault-simulation-engine-v1.0.md`
- `/docs/engine/storevault-engine-invariant-contract-v1.0.md`
- `/docs/engine/store-adapter-invariant-contract-v1.0.md`
