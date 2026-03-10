---
title: GridCoDe StoreVault Engine — Adversarial Test Plan
version: v1.0
status: Active Binding
domain: Store
layer: Engine Invariant Validation
tier: Tier-2
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/store/adversarial-threat-model-v1.0.md
  - /docs/engine/storevault-engine-invariant-contract-v1.0.md
  - /docs/store/store-v1-protocol-spec-v1.0.md
last_reviewed: 2026-03
---

# GridCoDe StoreVault Engine — Adversarial Test Plan

## 1. Purpose and Scope

This document defines the 14 adversarial test scenarios that MUST all pass before the StoreVault Engine is considered implementation-ready. These tests do not check that happy-path flows work — they specifically attempt to break the engine by violating its invariant contract.

The tests are organized into two groups.

AT-1 through AT-10 are engine-level invariant tests. These probe the core FSM directly: identity spoofing, role injection, illegal transitions, replay attacks, early finalization, missing proofs, corrupted aggregates, and determinism violations.

AT-11 through AT-14 are extended invariant tests added in the Build Guide: idempotent retry behavior, escrow linkage integrity, receipt chain tamper detection, and receiptCount mismatch detection.

Each test specifies: the attack being attempted, how the engine is set up, what the exploit attempt looks like, which invariant is being tested, and what the engine MUST return.

### 1.1 Layer Classification

| Header Color | Meaning |
|---|---|
| Engine | Core FSM invariant — StoreVault.ts and guards.ts MUST enforce this |
| Adapter | Boundary invariant — SimAdapter MUST enforce this |
| Engine + Adapter | Combined invariant requiring both layers |

## 2. Shared Test Fixtures

All tests use a standard base listing unless the test explicitly states otherwise.

```typescript
// Base listing fixture — LISTED state, clean
const baseListing: ListingAggregate = {
  id: 'listing-001',
  sellerId: 'seller-abc',
  buyerId: null,
  price: 50,                        // above minListingPriceGNC (10)
  state: 'LISTED',
  version: 1,
  receiptCount: 0,
  escrowTxId: null,
  purchaseTxId: null,
  settlementDeadline: null,
  settlementFinalized: false,
  deliveryProofHash: null,
  disputeRecord: null,
  receipts: [],
}

// Standard params fixture
const baseParams: StoreEconomicParams = {
  minListingPriceGNC: 10,
  fulfillmentWindowMs: 172800000,    // 48h
  disputeWindowMs: 86400000,         // 24h
}

// Standard timestamps
const T0 = 1000000000000             // base time
const T_AFTER_DEADLINE = T0 + 86400000 + 1  // just past dispute window
```

## 3. Adversarial Tests

### AT-1 — Identity Spoofing: Unknown Actor

**Layer:** Engine

**Attack Vector**

An actor with no relationship to the listing attempts any transition.

**Test Setup**

`listing = baseListing` (state: LISTED). `actorId = 'stranger-xyz'` — not `sellerId`, not `buyerId`.

**Exploit Attempt**

```typescript
executeAction(listing, 'PURCHASE', 'stranger-xyz', T0, baseParams, {
  expectedVersion: 1,
  isSystemContext: false,
  escrowTxId: 'tx-001',
  previousHash: 'genesis'
})
```

**Invariant Tested**

`deriveRole` returns UNKNOWN. Engine MUST reject before any transition logic runs.

**Expected Result**

`ok: false`. Listing unchanged. `errors: ['Actor identity could not be resolved']`. No receipt appended. No deltas.

**Mitigation Layer:** Engine — `deriveRole()` in dispatcher

---

### AT-2 — Role Spoofing: Seller Attempts to Buy Own Listing

**Layer:** Engine

**Attack Vector**

The seller attempts to purchase their own listing. `actorId` matches `sellerId`, so `deriveRole` returns SELLER — but PURCHASE requires BUYER.

**Test Setup**

`listing = baseListing` (state: LISTED). `actorId = 'seller-abc'`.

**Exploit Attempt**

```typescript
executeAction(listing, 'PURCHASE', 'seller-abc', T0, baseParams, {
  expectedVersion: 1,
  isSystemContext: false,
  escrowTxId: 'tx-001',
  previousHash: 'genesis'
})
```

**Invariant Tested**

`deriveRole = SELLER`. `guardRole(SELLER, 'BUYER')` fails. Transition MUST be rejected.

**Expected Result**

`ok: false`. Listing unchanged. Error indicates role mismatch. No receipt. No deltas.

**Mitigation Layer:** Engine — `guardRole()` in `applyPurchase()`

---

### AT-3 — Unauthorized Transition: Buyer Attempts CANCEL

**Layer:** Engine

**Attack Vector**

Buyer attempts to cancel a listing they do not own. Only SELLER MAY cancel.

**Test Setup**

Variant A: `baseListing` (state: LISTED). `actorId = 'buyer-def'` (not `sellerId`). `deriveRole` returns UNKNOWN.

Variant B: PURCHASED listing where `buyerId = 'buyer-def'`. Buyer attempts CANCEL.

**Exploit Attempt**

```typescript
// Variant A
executeAction(baseListing, 'CANCEL', 'buyer-def', T0, baseParams, { ... })

// Variant B
executeAction(purchasedListing, 'CANCEL', 'buyer-def', T0, baseParams, { ... })
```

**Invariant Tested**

No path exists for BUYER to reach CANCEL. Variant A fails at `deriveRole`. Variant B fails at `guardState(LISTED)`.

**Expected Result**

`ok: false` in both variants. Listing unchanged. Appropriate error returned for each case.

**Mitigation Layer:** Engine — `deriveRole()` and `guardState()`

---

### AT-4 — Early Finalization: FINALIZE_SETTLEMENT Before Deadline

**Layer:** Engine

**Attack Vector**

SYSTEM attempts to finalize settlement before the dispute window has closed.

**Test Setup**

`listing = baseListing` advanced to FULFILLED state. `settlementDeadline = T0 + 86400000`. Timestamp injected as `T0 + 1000` — well before deadline.

**Exploit Attempt**

```typescript
executeAction(fulfilledListing, 'FINALIZE_SETTLEMENT', 'system', T0 + 1000, baseParams, {
  expectedVersion: 2,
  isSystemContext: true,
  previousHash: '...'
})
```

**Invariant Tested**

`guardFinalizationWindow`: `timestamp >= settlementDeadline` MUST fail. `T0 + 1000 < deadline`.

**Expected Result**

`ok: false`. Listing unchanged. Error: finalization window not yet reached. No deltas emitted.

**Mitigation Layer:** Engine — `guardFinalizationWindow()` in `applyFinalizeSettlement()`

---

### AT-5 — Fulfillment Without Delivery Proof

**Layer:** Engine

**Attack Vector**

Seller attempts to mark a listing as FULFILLED without providing a `deliveryProofHash`.

**Test Setup**

`listing = baseListing` advanced to PURCHASED state (`buyerId` set). `deliveryProofHash` absent from context.

**Exploit Attempt**

```typescript
executeAction(purchasedListing, 'FULFILL', 'seller-abc', T0, baseParams, {
  expectedVersion: 2,
  isSystemContext: false,
  deliveryProofHash: '',
  previousHash: '...'
})
```

**Invariant Tested**

Delivery proof guard: `deliveryProofHash` MUST exist and be non-empty. Empty string MUST fail.

Invariant: if `state == FULFILLED` then `deliveryProofHash != null`.

**Expected Result**

`ok: false`. State remains PURCHASED. No receipt appended. `deliveryProofHash` remains null.

**Mitigation Layer:** Engine — delivery proof check in `applyFulfill()`

---

### AT-6 — Replay Attack: Transition Executed Twice

**Layer:** Engine

**Attack Vector**

A valid transition is replayed after it has already succeeded. The state machine MUST NOT advance a second time.

**Test Setup**

Execute FULFILL on a PURCHASED listing. This succeeds and listing advances to FULFILLED. Then replay the identical FULFILL call on the now-FULFILLED listing.

**Exploit Attempt**

```typescript
// First call — succeeds
executeAction(purchasedListing, 'FULFILL', 'seller-abc', T0, baseParams, { ... })

// Replay — must fail
executeAction(fulfilledListing, 'FULFILL', 'seller-abc', T0, baseParams, { ... })
```

**Invariant Tested**

`guardState(PURCHASED)` fails because current state is FULFILLED. Transition MUST be rejected.

**Expected Result**

`ok: false` on second call. Listing returned unchanged. No second receipt appended. `receiptCount` unchanged.

**Mitigation Layer:** Engine — `guardState()` in `applyFulfill()`

---

### AT-7 — Corrupted Aggregate Injection

**Layer:** Engine

**Attack Vector**

A malformed aggregate is injected where state and field values are internally contradictory. The engine MUST NOT evolve a corrupt aggregate further.

**Test Setup**

Construct a listing where `state = DISPUTED` but `disputeRecord = null`. This violates the state-field consistency invariant.

**Exploit Attempt**

```typescript
const corrupt = { ...baseListing, state: 'DISPUTED', disputeRecord: null }
executeAction(corrupt, 'RESOLVE_SELLER', 'system', T0, baseParams, {
  isSystemContext: true,
  evidenceValid: true,
  ...
})
```

**Invariant Tested**

Invariant: `state === DISPUTED` requires `disputeRecord !== null`. Engine MUST detect the contradiction and reject.

**Expected Result**

`ok: false`. Corrupt listing returned unchanged. Error indicates state-field inconsistency. No deltas. No receipt.

**Mitigation Layer:** Engine — state and field consistency validation

---

### AT-8 — Determinism Verification

**Layer:** Engine

**Attack Vector**

The engine MUST produce identical output for identical input regardless of when or how many times it is called. This test verifies no hidden state, time dependency, or randomness exists.

**Test Setup**

Prepare a fixed listing, action, `actorId`, timestamp, params, and context. All values fully specified.

**Exploit Attempt**

```typescript
const result1 = executeAction(listing, action, actorId, timestamp, params, context)
const result2 = executeAction(listing, action, actorId, timestamp, params, context)
const result3 = executeAction(listing, action, actorId, timestamp, params, context)
```

**Invariant Tested**

Determinism axiom: `δ(x) = δ(x)`. Identical inputs MUST produce identical outputs.

**Expected Result**

All three results MUST be byte-for-byte identical across: listing state, deltas, errors, and receipt hashes. Any divergence is a protocol breach.

**Mitigation Layer:** Engine — architectural constraint (no `Date.now()`, no randomness, no IO)

---

### AT-9 — Settlement Boundary Race: Dispute vs Finalize at Exact Deadline

**Layer:** Engine

**Attack Vector**

Tests the strict timestamp asymmetry at the settlement boundary. Dispute requires `timestamp < deadline`. Finalize requires `timestamp >= deadline`. There MUST be no overlap.

**Test Setup**

`listing = FULFILLED`. `settlementDeadline = T0 + 86400000` exactly.

Variant A: RAISE_DISPUTE at `timestamp = T0 + 86400000` (equal to deadline).

Variant B: FINALIZE_SETTLEMENT at `timestamp = T0 + 86399999` (1ms before deadline).

**Exploit Attempt**

```typescript
// Variant A
executeAction(listing, 'RAISE_DISPUTE', 'buyer-def', T0 + 86400000, baseParams, { ... })

// Variant B
executeAction(listing, 'FINALIZE_SETTLEMENT', 'system', T0 + 86399999, baseParams, { ... })
```

**Invariant Tested**

Strict asymmetry: dispute valid only if `timestamp < deadline` (strictly less than). Finalize valid only if `timestamp >= deadline`. No overlap is possible.

**Expected Result**

Variant A: `ok: false` — dispute window closed. Timestamp equal to deadline fails strict less-than.

Variant B: `ok: false` — finalization window not yet reached.

**Mitigation Layer:** Engine — `guardDisputeWindow()` and `guardFinalizationWindow()`

---

### AT-10 — Version Lock: Concurrent Purchase Attempt

**Layer:** Engine + Adapter

**Attack Vector**

Two buyers load the same LISTED listing simultaneously. Both pass engine validation. The version lock MUST prevent the second write from succeeding.

**Test Setup**

Buyer A and Buyer B both load `listing` at `version = 1`. Both call `executeAction(PURCHASE)`. The engine succeeds for both individually — version enforcement is at the Adapter. This test verifies the engine correctly increments version on success so the Adapter can detect the conflict.

**Exploit Attempt**

```typescript
const resultA = executeAction(listing_v1, 'PURCHASE', 'buyer-A', T0, baseParams, { ... })
const resultB = executeAction(listing_v1, 'PURCHASE', 'buyer-B', T0, baseParams, { ... })
```

**Invariant Tested**

Both engine calls succeed individually and return `version = 2`. The Adapter's stored-version check (`stored.version != loaded.version`) catches the conflict on the second write attempt.

**Expected Result**

Both engine results: `ok: true`, `version = 2`. Adapter discards the second result when stored version (2 after first write) does not match loaded version (1). Only one buyer succeeds.

**Mitigation Layer:** Engine increments version. Adapter enforces version lock on write.

---

### AT-11 — Idempotent Click Retry

**Layer:** Engine + Adapter

**Attack Vector**

A user double-clicks a button. The same action is submitted twice before the first result is processed. The second attempt MUST NOT produce a second state mutation.

**Test Setup**

`listing = LISTED` (version 1). First call succeeds: PURCHASE at version 1 returns version 2. Second call is submitted before the UI updates, still referencing version 1.

**Exploit Attempt**

```typescript
// Call 1 — succeeds
executeAction(listing_v1, 'PURCHASE', 'buyer-def', T0, baseParams, { expectedVersion: 1, ... })

// Call 2 — retry on stale aggregate
executeAction(listing_v1, 'PURCHASE', 'buyer-def', T0, baseParams, { expectedVersion: 1, ... })
```

**Invariant Tested**

The Adapter MUST reload the listing before retrying. After reload, `state = PURCHASED`, so `guardState(LISTED)` fails for PURCHASE.

**Expected Result**

Call 1: `ok: true`. Call 2 using stale aggregate: engine succeeds in isolation, but Adapter rejects on stored-version mismatch. After Adapter reload: state is PURCHASED, so the guard fails.

**Mitigation Layer:** Engine — version increment and state guard. Adapter — stored version check.

---

### AT-12 — Escrow TxId Absent: Purchase Without Confirmed Escrow

**Layer:** Engine

**Attack Vector**

A caller attempts PURCHASE without providing a valid escrow transaction ID. The escrow confirmation guard MUST NOT be bypassed.

**Test Setup**

`listing = baseListing` (LISTED). Context has no `escrowTxId`.

**Exploit Attempt**

```typescript
// Variant A — null escrowTxId
executeAction(listing, 'PURCHASE', 'buyer-def', T0, baseParams, {
  expectedVersion: 1,
  isSystemContext: false,
  escrowTxId: null,
  previousHash: 'genesis'
})

// Variant B — empty string escrowTxId
executeAction(listing, 'PURCHASE', 'buyer-def', T0, baseParams, {
  expectedVersion: 1,
  isSystemContext: false,
  escrowTxId: '',
  previousHash: 'genesis'
})
```

**Invariant Tested**

`applyPurchase` checks: `if (!context.escrowTxId)` then fail. Both null and empty string MUST be rejected.

**Expected Result**

`ok: false` in both variants. State remains LISTED. `buyerId` remains null. No receipt appended. Error: escrow confirmation required.

**Mitigation Layer:** Engine — escrow check in `applyPurchase()`

---

### AT-13 — Receipt Chain Tamper Detection

**Layer:** Engine + Adapter

**Attack Vector**

The receipt chain uses `SHA256(previousHash + canonicalPayload)` to create a tamper-evident audit trail. This test verifies the chain verifier detects tampering at any position.

**Test Setup**

Build a listing with 3 receipts forming a valid chain. Each receipt's `receiptHash` was computed from the prior hash.

Variant A: Tamper receipt at index 0 (change `receiptHash`).

Variant B: Tamper receipt at index 1 (middle of chain).

Variant C: Silently delete receipt at index 1.

**Exploit Attempt**

```typescript
// Variant A
verifyReceiptChain(tamperIndex0Listing)

// Variant B
verifyReceiptChain(tamperIndex1Listing)

// Variant C — guardReceiptCount fires first
guardReceiptCount(deletedReceiptListing)  // receiptCount=3, receipts.length=2
```

**Invariant Tested**

`verifyReceiptChain` MUST walk the full chain from genesis hash and recompute each `receiptHash`. Any mismatch MUST report `brokenAtIndex`. `guardReceiptCount` MUST detect silent deletion before the chain walk.

**Expected Result**

Variant A: `verifyReceiptChain` returns `{ valid: false, brokenAtIndex: 0 }`.

Variant B: returns `{ valid: false, brokenAtIndex: 1 }`.

Variant C: `guardReceiptCount` returns error before chain walk proceeds.

**Mitigation Layer:** Engine — `verifyReceiptChain()` and `guardReceiptCount()` in `receipts.ts`

---

### AT-14 — ReceiptCount Mismatch: Truncation and Injection

**Layer:** Engine + Adapter

**Attack Vector**

The `receiptCount` field MUST always equal `receipts.length`. This test verifies both forms of mismatch are detected: truncation (receipt deleted, count unchanged) and injection (receipt appended without incrementing count).

**Test Setup**

Variant A (truncation): `receiptCount = 3` but `receipts.length = 2`.

Variant B (injection): `receiptCount = 2` but `receipts.length = 3`.

**Exploit Attempt**

```typescript
// Variant A
guardReceiptCount({ ...listing, receiptCount: 3, receipts: twoItemArray })

// Variant B
guardReceiptCount({ ...listing, receiptCount: 2, receipts: threeItemArray })
```

**Invariant Tested**

`guardReceiptCount` MUST detect any mismatch between `receiptCount` and `receipts.length` regardless of direction.

**Expected Result**

Both variants: `guardReceiptCount` returns a descriptive error string including both values. Neither listing is accepted by the Adapter. No transition proceeds on a listing that fails this check.

**Mitigation Layer:** Engine and Adapter boundary — `guardReceiptCount()` in `guards.ts`, called by SimAdapter on every load and after every `atomicWrite()`

---

## 4. Pass Criteria

Every test MUST pass before the engine is considered ready for the Adapter layer. A test passes when the engine returns exactly the expected result.

| Criterion | Requirement |
|---|---|
| `ok` field | MUST be `false` on all adversarial tests |
| Listing unchanged | Returned listing MUST be reference-equal to input on failure — no partial mutation |
| `reputationDeltas` | MUST be empty on all failed transitions |
| `errors` | MUST contain a descriptive, non-empty error string |
| Receipts unchanged | No receipt appended on failed transitions — `receiptCount` unchanged |
| `version` unchanged | `version` MUST NOT increment on failed transitions |
| AT-8 determinism | All three calls return byte-identical results |
| AT-13 chain walk | `verifyReceiptChain` reports correct `brokenAtIndex` for each variant |
| AT-14 both directions | `guardReceiptCount` catches both truncation and injection |

## 5. What These Tests Do Not Cover

These 14 tests cover the engine invariant boundary and the receipt chain. They do not replace the following, which are tested separately.

- Happy-path transition tests (`store.test.ts`) — verifying all 8 valid transitions complete correctly
- Dispatcher guard order tests — verifying version lock fires before terminal lock fires before role derivation
- Adapter-level persistence tests — atomic write, version overwrite prevention, reload-before-retry
- Reputation delta integration tests — verifying deltas reach the Reputation Engine correctly
- SimAdapter phantom mode tests — verifying simulation parity with live execution

The adversarial tests prove the engine cannot be broken. The happy-path tests prove it works. Both are required.

## 6. Authoritative Sources

- `/docs/store/adversarial-threat-model-v1.0.md`
- `/docs/engine/storevault-engine-invariant-contract-v1.0.md`
- `/docs/store/store-v1-protocol-spec-v1.0.md`
- `/docs/store/storevault-simulation-engine-v1.0.md`

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-2 — Engine Invariant Validation
**Last Reviewed:** 2026-03
**Supersedes:** None
**Requires:**
- `/docs/store/adversarial-threat-model-v1.0.md`
- `/docs/engine/storevault-engine-invariant-contract-v1.0.md`
- `/docs/store/store-v1-protocol-spec-v1.0.md`
