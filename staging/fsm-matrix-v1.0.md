---
title: "GridCoDe Store v1 — Canonical Specification"
version: v1.0
status: Binding Protocol Specification
domain: Store
layer: Vault-Level Deterministic Commerce FSM
environment: Gridnet OS
authoritative: true
---

# GridCoDe Store v1 — Canonical Specification

## 1. Design Philosophy & Constraints

### 1.1 Objective

Store v1 establishes a deterministic, identity-bound commerce layer within GridCoDe that:

- Enables escrow-based product exchange
- Couples commerce with reputation growth
- Prevents identity spoofing
- Prevents micro-farming of reputation
- Enforces bounded timeout behavior
- Preserves deterministic state evolution

Store v1 is intentionally minimal and conservative.

It prioritizes:

- Security over feature richness
- Determinism over flexibility
- Explicit invariants over implicit behavior

### 1.2 Design Constraints

Store v1 MUST:

- Be fully deterministic
- Be free of internal randomness
- Be free of internal time fetching
- Be identity-bound at state machine level
- Emit reputation deltas only through predefined transitions
- Prevent unauthorized state mutation
- Support atomic persistence

Store v1 MUST NOT:

- Perform signature validation
- Access network resources
- Fetch economic parameters internally
- Depend on UI logic
- Modify reputation velocity logic

### 1.3 Architectural Separation of Concerns

| Layer | Responsibility |
|---|---|
| UI | User interaction only |
| Adapter | Identity resolution, param injection, atomic writes |
| StoreVault Engine | Pure deterministic state transition |
| Reputation Engine | Velocity scaling + RI bounds |
| Governance | Parameter control |

The StoreVault engine must remain ignorant of:

- Blockchain state
- UI behavior
- Governance mechanics
- Reputation velocity model

## 2. Formal State Machine Definition

### 2.1 States

The StoreVault FSM contains five primary states:

1. LISTED
2. PURCHASED
3. FULFILLED
4. DISPUTED
5. CANCELLED

Terminal composite state:

- FULFILLED with settlementFinalized = true

### 2.2 State Field Requirements

| State | Required Fields | Forbidden Fields |
|---|---|---|
| LISTED | buyerId = null | settlementDeadline |
| PURCHASED | buyerId ≠ null | settlementFinalized = true |
| FULFILLED | deliveryProofHash defined | disputeRecord if none active |
| DISPUTED | disputeRecord defined | settlementFinalized = true |
| CANCELLED | settlementFinalized = false | active dispute |

These invariants MUST hold at all times.

### 2.3 Transition Table

| From | Action | To | Role Required |
|---|---|---|---|
| LISTED | PURCHASE | PURCHASED | BUYER |
| LISTED | CANCEL | CANCELLED | SELLER |
| PURCHASED | FULFILL | FULFILLED | SELLER |
| PURCHASED | AUTO_CANCEL_TIMEOUT | CANCELLED | SYSTEM |
| PURCHASED | RAISE_DISPUTE | DISPUTED | BUYER |
| FULFILLED | RAISE_DISPUTE | DISPUTED | BUYER |
| FULFILLED | FINALIZE_SETTLEMENT | FULFILLED (terminal) | SYSTEM |
| DISPUTED | RESOLVE_SELLER | FULFILLED | SYSTEM |
| DISPUTED | RESOLVE_BUYER | CANCELLED | SYSTEM |

Any other transition MUST fail.

## 3. Identity Binding Model

### 3.1 Identity Source

actorId MUST originate from:

- Gridnet SubID registry
- Adapter-resolved identity mapping

UI-provided identity values are invalid.

### 3.2 Role Computation

Role is derived deterministically:

- If actorId === listing.sellerId → SELLER
- If actorId === listing.buyerId → BUYER
- If privileged adapter context → SYSTEM
- Otherwise → reject

The engine does not trust externally supplied role claims.

### 3.3 Identity Enforcement Invariants

- Seller may only act on own listing.
- Buyer may only dispute their own purchase.
- Buyer cannot act before purchase assignment.
- SYSTEM actions are adapter-gated.

No action may proceed without identity verification.

## 4. Economic Parameter Model

### 4.1 Governance-Controlled Parameters

Parameters MUST be loaded from governance-controlled config:

- minListingPriceGNC
- fulfillmentWindowMs
- disputeWindowMs

Engine must receive parameters as arguments.

### 4.2 Anti-Farming Constraint

```
minListingPriceGNC = 10
```

Rationale: Prevents micro-transaction loops for rapid RI farming.

### 4.3 Timeout Parameters

- Fulfillment window: 48 hours
- Dispute window: 24 hours

Timeouts exist to:

- Prevent capital lock abuse
- Enforce liveness
- Bound risk exposure

### 4.4 Reputation Delta Model

Base deltas are static and deterministic.

Velocity scaling occurs externally.

Store engine never applies scaling logic.

## 5. Temporal Model

### 5.1 Timestamp Injection

Timestamp MUST be injected from deterministic source.

Engine must not call system time.

### 5.2 Boundary Logic

```
Dispute validity:    timestamp < settlementDeadline
Settlement validity: timestamp ≥ settlementDeadline
Auto cancel validity: timestamp ≥ purchaseTimestamp + fulfillmentWindowMs
```

Boundaries are intentionally asymmetric to avoid overlap.

## 6. Delivery Proof Model

### 6.1 Requirement

FULFILL action MUST include:

```
deliveryProofHash
```

### 6.2 Proof Characteristics

Proof may be:

- IPFS hash
- Signed delivery receipt
- Oracle-provided confirmation

Engine does not validate proof authenticity.

Proof validation occurs externally.

### 6.3 Fulfillment Invariant

```
If state === FULFILLED:
  deliveryProofHash MUST exist
```

## 7. Atomic Persistence Model

### 7.1 Atomic Write Scope

Upon successful transition, Adapter MUST atomically persist:

1. Updated listing
2. Appended receipt
3. Reputation deltas

Partial persistence invalidates protocol guarantees.

### 7.2 Version Locking

Each listing MUST include:

```
version: number
```

Write operations MUST verify version consistency.

Prevents race-condition overwrites.

## 8. Determinism Guarantees

The engine:

- Produces identical output for identical input
- Has no external state dependencies
- Does not mutate input
- Has no asynchronous behavior
- Has no network calls

## 9. Security Guarantees

Store v1 prevents:

- Identity spoofing
- Role spoofing
- Double purchase
- Double dispute
- Double finalize
- Dispute after deadline
- Premature settlement
- Micro RI farming below threshold

## 10. Known Limitations (Explicit)

Store v1 does NOT support:

- Partial fulfillment
- Multi-item atomic baskets
- Escrow splits
- On-chain arbitration
- Signature validation
- Dynamic delta scaling
- Multi-party seller pools

These require v2 specification.

## 11. Concurrency & Race Condition Model

Store v1 operates in an environment where multiple actors may attempt actions on the same listing concurrently.

Concurrency safety is not optional.

### 11.1 The Double Purchase Problem

Scenario:

- Buyer A and Buyer B attempt PURCHASE simultaneously.
- Both load LISTED state.
- Both pass engine validation.
- Without version control, both write PURCHASED.

Mitigation:

Each listing MUST include:

```
version: number
```

Adapter must:

1. Load listing with version X.
2. Execute engine.
3. Attempt write only if current stored version == X.
4. On success, increment version to X+1.

If version mismatch occurs:

- Abort operation.
- Reload listing.
- Re-evaluate transition.

### 11.2 Idempotency Rule

The StoreVault engine is idempotent by design.

Invalid transitions do not mutate state.

Adapter must not retry blindly without reloading state.

### 11.3 Receipt Ordering Guarantee

Receipts are appended sequentially.

Invariant:

```
receiptIndex = listing.receipts.length
```

Receipts must never be overwritten.

### 11.4 Dispute Resolution Race

If:

- Buyer disputes at T
- SYSTEM attempts finalize at same timestamp

Boundary logic ensures:

- Dispute valid if < deadline
- Finalize valid if ≥ deadline

No overlap possible.

## 12. SYSTEM Authority Model

SYSTEM is a privileged actor.

In v1, SYSTEM is adapter-controlled.

### 12.1 SYSTEM Capabilities

SYSTEM may:

- Trigger AUTO_CANCEL_TIMEOUT
- Execute RESOLVE_SELLER
- Execute RESOLVE_BUYER
- Execute FINALIZE_SETTLEMENT

SYSTEM may NOT:

- Modify listing price
- Modify proof hash
- Modify buyerId
- Bypass version locking

### 12.2 SYSTEM Trust Assumption

In v1: SYSTEM is trusted.

In future: SYSTEM should be replaced by smart contract enforcement, DAO-controlled arbitration, or a deterministic scheduler.

Trust boundary must be documented.

## 13. Reputation Interaction Model

StoreVault emits base deltas only.

It does not:

- Enforce RI cap
- Enforce velocity reduction
- Apply stake-weight scaling

Those belong to Reputation Engine.

### 13.1 Reputation Data Flow

```
StoreVault Engine
  → emits baseDelta

Adapter
  → passes baseDelta to Reputation Engine

Reputation Engine
  → applies velocity scaling
  → updates RI
```

Separation prevents:

- Commerce layer manipulating velocity logic.
- Reputation layer interfering with state transitions.

### 13.2 Anti-Farming Interaction

Reputation Engine must:

- Slow progression after 60 RI
- Further slow after 70
- Further slow after 80
- 100 RI unreachable asymptotically

StoreVault relies on this to bound long-term collusion risk.

## 14. Failure Modes & Recovery

### 14.1 Adapter Crash During Transaction

If crash occurs before commit:

- No write occurs.
- Listing remains unchanged.

If crash occurs after commit but before response:

- Client may retry.
- Engine will reject duplicate action due to state change.

System remains consistent.

### 14.2 Proof Hash Invalid

Engine does not validate proof authenticity.

If proof later found invalid:

- Buyer must dispute.
- SYSTEM resolves based on external verification.

### 14.3 Governance Parameter Change Mid-Listing

Economic parameters affect future transitions only.

Past state transitions remain valid.

Adapter must ensure param load is consistent within single execution.

## 15. Liveness Guarantees

Store v1 ensures:

- Listings cannot remain PURCHASED indefinitely.
- Fulfilled listings cannot remain unresolved indefinitely.
- Disputes cannot remain unresolved indefinitely (SYSTEM must act).

Timeout windows bound capital exposure.

## 16. Data Model (Complete Aggregate)

```typescript
ListingAggregate {
  listingId:            string
  sellerId:             string
  buyerId:              string | null
  price:                number
  state:                StoreState
  receipts:             Receipt[]
  disputeRecord:        DisputeRecord | null
  purchaseTimestamp?:   number
  settlementDeadline?:  number
  settlementFinalized:  boolean
  deliveryProofHash?:   string
  version:              number
}
```

All state transitions must respect field invariants.

## 17. Receipt Model

```
Receipt {
  receiptId
  listingId
  action
  fromState
  toState
  receiptState
  timestamp
}
```

Persistence layer may append txid and blockHeight.

Engine does not include chain metadata.

## 18. Formal Invariants Summary

1. Determinism invariant
2. Identity binding invariant
3. Delivery proof invariant
4. Timeout invariant
5. Version lock invariant
6. Atomic persistence invariant
7. Reputation delta exclusivity invariant
8. Terminal state immutability invariant
9. No hidden transitions invariant
10. No state mutation on error invariant

These invariants define Store v1 correctness.

## 19. Explicit Non-Goals

Store v1 does NOT attempt to:

- Solve decentralized arbitration
- Eliminate SYSTEM trust
- Provide milestone-based payments
- Provide escrow splitting
- Provide variable delta scaling
- Provide complex bundle logic
- Provide dynamic pricing enforcement

Scope discipline is intentional.

## 20. Versioning & Future Extension

Any of the following requires v2:

- Partial fulfillment
- Escrow splits
- Multi-party sellers
- Oracle-based auto-verification
- On-chain arbitration
- Signature validation inside engine

## 21. Formal State Transition Algebra

Let:

- S ∈ {LISTED, PURCHASED, FULFILLED, DISPUTED, CANCELLED}
- A ∈ StoreAction
- T = timestamp
- P = economic parameters
- L = ListingAggregate

Define:

```
δ : (L, A, actorId, role, T, P) → (L', Δ, E)
```

Where:

- L' = new listing
- Δ = reputation deltas
- E = error set

### 21.1 Determinism Axiom

For identical inputs:

```
δ(x) = δ(x)
```

No randomness. No external state dependency.

### 21.2 Transition Validity Predicate

For transition to succeed:

```
Valid(S, A, role, actorId, T, P) = true
```

Otherwise:

- L' = L
- Δ = ∅
- No receipt appended

### 21.3 State Exclusivity

At any time:

```
L.state ∈ S
```

And no implicit sub-states exist.

### 21.4 Terminal Condition

If:

```
L.settlementFinalized = true
Then: ∀ A ≠ FINALIZE_SETTLEMENT → invalid
```

## 22. State Consistency Proof Sketch

We demonstrate that no invalid state can emerge.

### 22.1 Proof: No Orphan Buyer

**Claim:** If state = LISTED → buyerId = null

**Proof:**

- Only PURCHASE assigns buyerId.
- PURCHASE transitions LISTED → PURCHASED.
- No transition assigns buyerId in LISTED.

Therefore invariant holds.

### 22.2 Proof: No Fulfilled Without Proof

**Claim:** If state = FULFILLED → deliveryProofHash defined.

**Proof:**

- Only FULFILL sets state to FULFILLED.
- FULFILL requires deliveryProofHash.
- No other transition sets FULFILLED without proof.

Invariant preserved.

### 22.3 Proof: No Double Dispute

**Claim:** Only one dispute may exist.

**Proof:**

- DISPUTED state requires disputeRecord ≠ null.
- RAISE_DISPUTE checks disputeRecord === null.
- No transition creates second dispute.

Invariant preserved.

### 22.4 Proof: No Double Finalization

**Claim:** Settlement may only finalize once.

**Proof:**

- FINALIZE_SETTLEMENT requires settlementFinalized = false.
- Upon execution sets settlementFinalized = true.
- All further actions invalid.

Invariant preserved.

## 23. Threat Model Appendix

| Threat | Description | Mitigation |
|---|---|---|
| Identity Spoofer | Claims SELLER/BUYER role | Identity binding enforced |
| Replay Attacker | Replays same action | State invalidation |
| Race Attacker | Concurrent purchase | Version locking |
| Griefing Buyer | False dispute spam | Negative RI + capital lock |
| Colluding Pair | RI farming | Min price + velocity friction |
| Malicious Seller | Never fulfills | Auto cancel penalty |
| SYSTEM Abuse | Arbitrary resolution | Governance-bound |

## 24. Adversarial Classification

### 24.1 Type I — Identity Attack

Prevented by role binding + SubID resolution.

### 24.2 Type II — Temporal Attack

Prevented by strict inequality boundaries.

### 24.3 Type III — Economic Loop Exploit

Bounded by:

- Minimum capital threshold
- Time delays
- Velocity reduction curve

### 24.4 Type IV — Concurrency Attack

Prevented by:

- Version locking
- Atomic write wrapper

## 25. Economic Equilibrium Analysis

Let:

- Seller gains +2 per successful cycle.
- Buyer gains +1 per successful cycle.

Total RI emitted per successful non-disputed sale: +3 base units.

However: Velocity curve V(RI) reduces effective gain as RI increases.

As RI → high levels: Effective gain → asymptotically small.

Thus infinite farming requires:

- Infinite time
- Increasing capital lock
- Diminishing marginal return

Equilibrium achieved via friction.

## 26. Liveness & Safety Properties

**Safety**

System never:

- Produces illegal state
- Allows unauthorized mutation
- Emits duplicate delta
- Leaves state partially mutated

**Liveness**

Every PURCHASED state will eventually resolve to FULFILLED, CANCELLED, or DISPUTED.

No indefinite lock possible.

## 27. Formal Security Properties

Store v1 satisfies:

1. State Transition Safety
2. Identity Soundness
3. Deterministic Execution
4. Bounded Capital Exposure
5. Reputation Emission Exclusivity
6. Single-Writer Concurrency Guarantee
7. Non-Bypassable Terminal Condition

## 28. Protocol-Level Assertions

The StoreVault FSM is:

- Closed under valid transition set
- Resistant to unauthorized mutation
- Economically friction-bound
- Deterministic under concurrency control
- Adapter-dependent for atomic integrity

## 29. Readiness Assessment

StoreVault v1 qualifies as:

- Minimal secure commerce core
- Reputation-coupled escrow layer
- Gridnet-compatible deterministic module
- DAO-governable parameterized FSM

## Final Canonical Statement

StoreVault v1.0 is: Formally specified. Threat-modeled. Economically bounded. Identity-secured. Concurrency-aware. Adapter-constrained. Implementation-ready.

---

**Canonical Status:** Binding Protocol Specification
**Document Tier:** Tier 1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/store/protocol-v1.0.md`
- `/docs/store/simulation-engine-v1.0.md`
- `/docs/governance/reputation-stake-governance-v1.0.md`
- `/docs/nft/entitlement-nft-standard-v1.0.md`
