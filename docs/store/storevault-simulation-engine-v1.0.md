---
title: StoreVault Simulation Engine
version: v1.0
status: Active Binding
domain: Core
layer: Deterministic Execution
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/store/store-protocol-v1.0.md
  - /docs/identity/reputation-stake-governance-v1.0.md
last_reviewed: 2026-02
---

# StoreVault Simulation Engine

**Depends On:**

- Store Protocol v1.0
- Economic Parameter Registry v1.0
- Reputation & Stake Governance v1.0

## 1. Core Responsibility

StoreVault Simulation must:

- Accept a ListingAggregate
- Accept an Action
- Validate role
- Validate state transition
- Generate receipt
- Return:
  - New ListingAggregate
  - Reputation base deltas
  - Escrow/stake effects (if any)

It must NOT:

- Modify RI directly
- Talk to wallet
- Use CVMContext
- Depend on time implicitly

Time must be injected.

## 2. Core Data Structures

### 2.1 StoreState Enum

```
StoreState =
  LISTED
  PURCHASED
  FULFILLED
  DISPUTED
  CANCELLED
```

### 2.2 ReceiptState Enum

```
ReceiptState =
  PENDING
  PRECONFIRMED
  CONFIRMED
  FAILED
  DISPUTED_FLAGGED
```

### 2.3 ListingAggregate

```
ListingAggregate {
  listingId
  sellerId
  buyerId | null
  state: StoreState
  receipts[]
  disputeRecord | null
  settlementDeadline | null
  settlementFinalized: boolean
}
```

Immutable.

## 3. Simulation Interface

```
simulateStoreAction(
  listing:          ListingAggregate,
  action:           StoreAction,
  actorId:          string,
  timestamp:        number,
  params:           StoreEconomicParams,
  escrowConfirmed?: boolean,
  evidenceValid?:   boolean
): SimulationResult
```

`role` is NOT accepted as an input parameter. Role MUST be derived internally by the engine from `actorId` matched against the listing context and SubID registry. Externally supplied roles are untrusted and MUST be rejected.

### 3.1 StoreAction Enum

```
PURCHASE
CANCEL
FULFILL
RAISE_DISPUTE
RESOLVE_SELLER
RESOLVE_BUYER
FINALIZE_SETTLEMENT
```

### 3.2 SimulationResult

```
SimulationResult {
  newListing: ListingAggregate
  reputationDeltas: {
    sellerDelta?: number
    buyerDelta?: number
  }
  errors?: string[]
}
```

Vault returns base deltas only.

Reputation Engine handles scaling.

### 3.3 StoreEconomicParams

```
StoreEconomicParams {
  minListingPriceGNC:       number
  fulfillmentWindowMs:      number
  disputeWindowMs:          number
}
```

Parameters must be injected from governance-controlled config. Engine must never hardcode durations or thresholds.

## 4. Transition Logic (Deterministic)

Before any transition is evaluated, the engine MUST derive the actor's role internally:

```
derivedRole =
  if actorId === listing.sellerId  → SELLER
  if actorId === listing.buyerId   → BUYER
  if actorId is privileged adapter → SYSTEM
  else                             → UNKNOWN → reject
```

Role is never accepted as a caller-supplied parameter. A caller asserting a role they do not hold MUST be rejected before any transition evaluation. If `derivedRole === UNKNOWN`, the engine MUST return an error and halt.

Additionally, the engine MUST enforce a single active purchase guard:

```
if action === PURCHASE and state ∈ {PURCHASED, DISPUTED} → reject
```

This invariant is explicit. It is not inferred from state machine logic alone.

### 4.1 PURCHASE

Valid if:

- state == LISTED
- role == BUYER
- escrowConfirmed == true

Effects:

- state → PURCHASED
- buyerId set
- receipt generated
- no RI delta yet

### 4.2 CANCEL

Valid if:

- state == LISTED
- role == SELLER

Effects:

- state → CANCELLED
- receipt generated
- no RI delta

### 4.3 FULFILL

Valid if:

- state == PURCHASED
- role == SELLER

Effects:

- state → FULFILLED
- settlementDeadline = timestamp + params.disputeWindowMs
- settlementFinalized = false
- receipt generated

No RI delta yet.

### 4.4 RAISE_DISPUTE

Valid if:

- state == PURCHASED or FULFILLED
- role == BUYER
- settlementFinalized == false
- timestamp < settlementDeadline

Effects:

- state → DISPUTED
- disputeRecord created
- receiptState → DISPUTED_FLAGGED

No RI delta yet.

### 4.5 RESOLVE_SELLER

Valid if:

- state == DISPUTED
- evidenceValid == true

Effects:

- state → FULFILLED
- settlementFinalized = true (immediate — Store Protocol v1 rule)
- receipt generated
- sellerDelta = +1
- buyerDelta = −2 (Minor Fault: frivolous dispute — maps to Governance v1.0 Section 8.1)

Settlement finalises immediately on resolution. The dispute window does not continue.

### 4.6 RESOLVE_BUYER

Valid if:

- state == DISPUTED
- evidenceValid == false

Effects:

- state → CANCELLED
- settlementFinalized = true (immediate — Store Protocol v1 rule)
- receipt generated
- sellerDelta = −4 (Major Fault: contract breach / failure to deliver — maps to Governance v1.0 Section 8.2)
- buyerDelta = +1

### 4.7 FINALIZE_SETTLEMENT

Valid if:

- state == FULFILLED
- timestamp ≥ settlementDeadline
- no active dispute

Effects:

- settlementFinalized = true
- sellerDelta = +2
- buyerDelta = +1

NFT mint trigger condition satisfied externally.

## 5. Deterministic Guarantees

Given:

- Same prior state
- Same action
- Same timestamp
- Same flags

Output MUST be identical.

No hidden logic. No time fetch. No randomness.

All arithmetic MUST use fixed-point integer arithmetic. Floating-point operations are prohibited.

Every successful state transition MUST produce exactly one receipt reflecting `fromState` and `toState`. No transition completes without a corresponding receipt. This is the receipt–state mirror guarantee.

## 6. Example Walkthroughs

### 6.1 Clean Flow

1. LISTED
2. PURCHASE (escrowConfirmed = true)
3. FULFILL
4. FINALIZE_SETTLEMENT (after 24h)

Reputation Deltas:

- Seller: +2
- Buyer: +1

Reputation Engine applies velocity scaling.

### 6.2 Dispute — Seller Wins

1. PURCHASE
2. FULFILL
3. RAISE_DISPUTE
4. RESOLVE_SELLER

Deltas:

- Seller: +1
- Buyer: −2 (Minor Fault — frivolous dispute)

settlementFinalized = true immediately on resolution.

### 6.3 Dispute — Buyer Wins

1. PURCHASE
2. FULFILL
3. RAISE_DISPUTE
4. RESOLVE_BUYER

Deltas:

- Seller: −4 (Major Fault — contract breach / failure to deliver)
- Buyer: +1

settlementFinalized = true immediately on resolution.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/store/store-protocol-v1.0.md`
- `/docs/identity/reputation-stake-governance-v1.0.md`
