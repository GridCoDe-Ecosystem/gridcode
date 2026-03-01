---
title: GridCoDe Contract Specification (GCSPEC) — Full Reference
version: v1.1
status: Active Binding
domain: Core
layer: Contract Specification — Full Reference
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: GCSPEC v1.0
companion: /docs/runtime/contract-specification-gcspec-v1.1.md
requires:
  - /docs/runtime/runtime-execution-architecture-v1.1.md
  - /docs/identity/subid-role-technical-spec-v1.2.md
  - /docs/identity/reputation-stake-governance-v1.0.md
last_reviewed: 2026-02
---

# GridCoDe Contract Specification (GCSPEC) — Full Reference

*A Formal Specification of All Vault Logic, State Machines, Metadata Flows, User Roles, Evidence Models, and Execution Constraints*

## 1. Purpose

GCSPEC v1.1 defines the complete behaviour of all GridCoDe contract types — implemented as deterministic Vault state machines, executed through Worker-validated metadata, and gated by Phantom Mode simulation.

This specification eliminates ambiguity by defining: allowed states, allowed transitions (always 1 TX per value mutation), metadata requirements, SubID role permissions, evidence rules, payout logic, security constraints, failure handling, and multi-recipient transaction behaviour.

GCSPEC does not define smart contracts. GridCoDe Vaults are static, deterministic execution engines, not programmable on-chain code.

## 2. Core Principles of All GridCoDe Contracts

### 2.1 Vaults Are Deterministic State Machines

Every contract type is implemented as a finite-state machine (FSM):

- No branching logic beyond what is defined here
- No runtime code injection
- No programmable behaviour
- No ambiguity in transitions

### 2.2 One Transaction Per Value Mutation

Each value-mutating transition maps to exactly one transaction. Non-value transitions require no transaction.

### 2.3 Worker-Validated Metadata

All contract metadata MUST:

- Be stored in BER format
- Include `schema_version` and `checksum` fields
- Be decoded, normalised, and validated by a Worker
- Match Phantom Mode expectations

### 2.4 Phantom Mode Simulation Required

Before any contract step executes:

1. Metadata is loaded
2. Worker validates it
3. Phantom Mode simulates the exact outcome
4. Only after simulation success may the user sign the transaction

No direct execution without Phantom validation.

### 2.5 SubID Identity Enforcement

Each contract defines required roles drawn from the canonical SubID set. The eight canonical SubIDs are:

- `SponsorID`
- `SellerID`
- `TraderID`
- `ProviderID`
- `CreatorID`
- `BorrowerID`
- `LenderID`
- `ParticipantID`

No Vault may introduce SubID classes outside this set. A SubID cannot perform an action it lacks permission for. All enforcement references `/docs/identity/subid-role-technical-spec-v1.2.md`.

### 2.6 Multi-Recipient Transactions Are Mandatory

Any payout involving more than one party MUST use multi-output TX. Single-output TX for multi-party payouts is prohibited.

### 2.7 Receipts Are First-Class Evidence

Each transaction generates a receipt (including pending state). Receipts serve as: evidence, proof of actions, dispute anchors, and binding metadata references.

### 2.8 Disputes Are Deterministic

All contract types with disputes MUST resolve them through: vault-defined FSM, evidence evaluation rules, timeout logic, TrustBond slashing rules. No subjective arbitration.

### 2.9 Reputation Mutation Rule

All reputation updates MUST follow the canonical path:

```
Vault FSM → baseDelta → Reputation Engine scaling
```

No Vault directly mutates RI. No alternate mutation channels are permitted.

## 3. Contract Types

GridCoDe defines eight Vault contract families. Each has a dedicated FSM.

| # | Vault | Domain |
|---|---|---|
| 1 | ActivationVault | Grid lifecycle |
| 2 | TradeVault | P2P exchange |
| 3 | StoreVault | Commerce escrow |
| 4 | ServiceVault | Human task escrow |
| 5 | ChallengeVault | Proof competition |
| 6 | LendingVault | Collateral loans |
| 7 | InsuranceVault | Deterministic claims |
| 8 | TrustBondVault | Slashing and collateral |

## 4. ActivationVault Specification

*For Sponsors activating grids for an epoch.*

Authoritative specification: `/docs/contracts/grid-activation-contract-spec-v1.0.md`

### 4.1 Roles

- `SponsorID` (required)

### 4.2 Allowed States

```
INIT → ACTIVATING → ACTIVE → FINALIZING → EXPIRED
```

`ACTIVATING` is an ephemeral Vault transition state and is not persisted in `activation-meta.status`.

### 4.3 Transitions

**`INIT → ACTIVATING`** — Triggered when Sponsor initiates activation.

Requirements: `SponsorID`, activation grid metadata present, Phantom Mode success, RI ≥ `minimum_sponsor_RI`, stake `S_sp` available, Treasury seed `S_gc` available.

TX: Stake lock; receipt generated.

**`ACTIVATING → ACTIVE`** — Triggered when transaction confirms.

Effects: grid marked active (`grid-meta.active = true`), all shards set `VACANT`, `activation-meta.status = Active`, epoch timer started. All writes are atomic within one execution block.

**`ACTIVE → FINALIZING`** — Triggered by `epoch_end` timestamp.

Effects: yield aggregation begins; no new shard claims permitted.

**`FINALIZING → EXPIRED`** — Triggered by YieldDistributor after payout map generation.

TX: One multi-output yield distribution TX. Effects: `grid-meta.active = false`, `activation-meta.status = Expired`, all shard states set `EXPIRED`, all stakes (`S_sp`, `S_p`, `S_gc`) unlocked. All writes are atomic.

**`EXPIRED → ACTIVATING`** — Reactivation path. Same preconditions as initial activation.

### 4.4 Value Rules

- Activation stake lock → 1 TX
- Yield distribution → 1 multi-output TX

### 4.5 Reputation Effects

- Successful activation epochs → positive `baseDelta`
- Failed activation conditions → none (no value mutation)

## 5. TradeVault Specification

*For P2P crypto trading — atomic swaps between two matching SubIDs.*

Authoritative specification: `/docs/contracts/trade-offer-contract-spec-v1.0.md`

### 5.1 Roles

- `TraderID` — both maker (offer creator) and taker (offer acceptor)

No separate `BuyerID` class exists for TradeVault. Both parties MUST hold `TraderID`.

### 5.2 States

```
INIT → ACTIVE → PARTIAL* → FILLED
          │
          └──▶ CANCELLED
          └──▶ EXPIRED
```

`FILLED`, `CANCELLED`, and `EXPIRED` are terminal states.

### 5.3 Transitions

**`INIT → ACTIVE`** — Maker creates offer.

Requirements: `TraderID`, shard `CLAIMED`, grid `ACTIVE`, `give_asset ≠ want_asset`, `give_amount > 0`, `want_amount > 0`, `rate > 0`.

TX: metadata write only (no value transfer at creation).

**`ACTIVE → PARTIAL`** — Taker partially fills offer.

Requirements: Taker `TraderID`, rate invariant maintained via cross-multiplication (`original_give × remaining_want == original_want × remaining_give`), amounts valid, expiry not exceeded.

TX: 1 multi-output settlement TX (`maker`, `taker`, `sponsor`, `treasury`).

**`ACTIVE/PARTIAL → FILLED`** — Taker fully fills offer.

TX: 1 multi-output settlement TX. All amounts exactly consumed.

**`ACTIVE/PARTIAL → CANCELLED`** — Maker cancels. Only `trader_subid` may cancel.

**`ACTIVE/PARTIAL → EXPIRED`** — Automatic after `expiry_timestamp`.

### 5.4 Fee Model

1% total. 0.5% → Sponsor. 0.5% → Treasury. Applied on gross taker → maker transfer value.

### 5.5 Reputation Effects

- Completed trades → positive `baseDelta` (both parties)
- Fraudulent settlement → negative `baseDelta`

## 6. StoreVault Specification

*For product sales, NFTs, digital goods.*

Authoritative specification: `/docs/core/store-protocol-v1.0.md`

### 6.1 Roles

- `SellerID`
- Buyer (any grid-permitted SubID)
- `SYSTEM` (Vault context only)

### 6.2 States

```
LISTED → PURCHASED → FULFILLED → CLOSED
                  │
                  └──▶ REFUNDED → CLOSED
```

### 6.3 Transitions

**`LISTED → PURCHASED`** — Buyer purchases product.

TX: Buyer payment. Metadata updated. Pending receipt available to both parties.

**`PURCHASED → FULFILLED`** — Seller delivers goods.

No TX — evidence-only metadata update.

**`PURCHASED → REFUNDED`** — Buyer initiates dispute or seller cancels.

TX: Refund to buyer.

**`FULFILLED → CLOSED`** — Auto-closes after confirmation.

TX: 1 multi-output payout — Seller, Sponsor percent, Treasury percent.

### 6.4 Reputation Effects

- Finalised fulfilment → positive `baseDelta` (seller)
- Proven fraud → negative `baseDelta`
- Dispute abuse → scaled penalty

## 7. ServiceVault Specification

*For human-performed tasks — errands, digital tasks, delivery.*

ServiceVault has the most complex FSM due to evidence, disputes, and payout logic.

### 7.1 Roles

- `ProviderID`
- Funding SubID (escrow originator)

No `RequesterID` class exists. The funding SubID is the escrow originator and counterparty.

### 7.2 Deterministic Role Binding

```
funding_subid  == escrow_originator
provider_subid == accepted_provider
```

### 7.3 States

```
OPEN → ACCEPTED → PROVIDER_SUBMITTED → REQUESTER_REVIEW
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
                           APPROVED                        DISPUTE
                              │                               │
                           PAID                      VAULT_EVALUATION
                                                             │
                                          ┌──────────────────┼──────────────┐
                                          │                  │              │
                                   PAY_PROVIDER        REFUND         SLASH_PROVIDER
                                          │                  │              │
                                          └──────────────────┴──────────────┘
                                                             │
                                                           CLOSED
```

### 7.4 Transitions

**`OPEN → ACCEPTED`** — Provider accepts service.

TX: Provider stake (if required). Pending receipt created.

**`ACCEPTED → PROVIDER_SUBMITTED`** — Provider submits evidence.

No TX. Evidence includes: images, screenshots, receipts, tracking links, pending TX receipts.

**`PROVIDER_SUBMITTED → REQUESTER_REVIEW`** — Requester sees all evidence. No TX.

**`REQUESTER_REVIEW → APPROVED`** — Requester accepts work.

TX: 1 multi-output payout. TrustBond returned. Metadata finalised.

**`REQUESTER_REVIEW → DISPUTE`** — Requester rejects evidence. No TX.

**`DISPUTE → VAULT_EVALUATION`** — Vault evaluates deterministically: evidence validity, timestamp constraints, service terms in metadata, provider TrustBond status.

**`VAULT_EVALUATION → PAY_PROVIDER / REFUND / SLASH`**

TX: 1 TX for each outcome. All payouts and slashes via one TX.

### 7.5 Reputation Effects

- Approved completion → positive `baseDelta` (provider)
- Fraud → negative `baseDelta` + TrustBond slash

TrustBondVault executes slashing.

## 8. ChallengeVault Specification

*For community competitions, proofs-of-effort, timed submissions.*

Authoritative specification: `/docs/contracts/challenge-creation-contract-spec-v1.0.md`

### 8.1 Roles

- `CreatorID` — shard tenant host; holds tenancy, locks stake, registers weight
- `ParticipantID` — entry-layer only; no shard tenancy, no stake lock, no yield weight

### 8.2 States

```
INIT → ACTIVE → ENDED → CLOSED
          │
          └──▶ EXPIRED → CLOSED
```

### 8.3 Transitions

**`INIT → ACTIVE`** — Creator creates challenge, reward pool locked.

TX: Reward pool lock (1 TX).

**`ACTIVE → ENTERED`** (participant sub-state) — Participant joins.

Requirements: `ParticipantID`, `challenge.status = ACTIVE`, `participants_count < participants_max`, RI ≥ threshold.

TX: Entry fee if applicable (1 TX). `participants_count` increment and join receipt MUST be atomic.

**`ENTERED → SUBMITTED`** — Participant submits proof.

No TX. Proof validation MUST resolve to deterministic boolean before metadata mutation. Proofs unvalidated at `end_timestamp` are automatically marked invalid.

**`SUBMITTED → VERIFIED`** — Vault applies deterministic logic: timestamp, evidence integrity, rule set in metadata.

**`VERIFIED → WON / LOST`** — Based on rules. Multiple winners allowed.

**`ACTIVE → ENDED`** — Manual close by `CreatorID`.

**`ACTIVE → EXPIRED`** — Automatic at `end_timestamp`.

**`ENDED / EXPIRED → CLOSED`** — Reward distribution.

TX: 1 multi-output payout. `unused_reward_refund = locked_reward_pool − sum(distributed_rewards) − governance_fee`.

### 8.4 Reputation Effects

- Verified participation → positive `baseDelta`
- Fraudulent proof → negative `baseDelta`

RI boost rewards MUST route through ReputationVault deterministic path. `reward_amount` for `reward_type = 2` (RI Boost) MUST be ≤ `max_RI_boost_per_challenge` from `GlobalConfig`.

## 9. LendingVault Specification

*For collateralised loans with deterministic liquidation.*

Authoritative specification: `/docs/contracts/loan-contract-spec-v1.0.md`

### 9.1 Roles

- `BorrowerID`
- `LenderID`

### 9.2 States

```
INIT → COLLATERAL_LOCKED → ACTIVE → REPAID
                                │
                                └──▶ DEFAULTED → LIQUIDATED
```

`REPAID` and `LIQUIDATED` are terminal encoded states. `CLOSED` is a logical archival condition used in diagrams to denote finality — it is not a distinct encoded status value.

### 9.3 Transitions

**`INIT → COLLATERAL_LOCKED`** — Borrower locks required collateral.

TX: Collateral lock (1 TX). Collateral MUST be locked before funds are released.

**`COLLATERAL_LOCKED → ACTIVE`** — Lender funds loan.

TX: Loan disbursement (1 TX).

**`ACTIVE → REPAID`** — Borrower makes repayment.

TX: 1 multi-output TX `[{lender_pool, repayment_amount}, {borrower, collateral_return}]`. Receipt becomes binding proof. Collateral automatically released.

**`ACTIVE → DEFAULTED`** — Triggered by deterministic timestamp check only (not oracle, not discretion).

**`DEFAULTED → LIQUIDATED`** — Oracle price revaluation. If `collateral ≥ debt` → remainder returned to borrower. If `collateral < debt` → full collateral seized. 1% liquidation fee to Treasury.

TX: 1 multi-output liquidation TX.

### 9.4 Interest Accrual Constraint

All arithmetic MUST use integer-only (fixed-point) math. Floating-point operations prohibited. `elapsed_time` MUST be injected deterministically using on-chain timestamps. `epoch_duration` MUST be sourced from `GlobalConfig`. All intermediate values MUST be computed within u128 boundaries.

### 9.5 Reputation Effects

- Successful repayment → positive `baseDelta`
- Default → negative `baseDelta`
- Liquidation → scaled penalty

## 10. InsuranceVault Specification

*For deterministic claim processing.*

### 10.1 Roles

- `ProviderID`
- Policy-holding SubID

No `InsuredID` class exists. The policy holder is referenced by their canonical SubID.

### 10.2 States

```
COVERED → CLAIMED → REVIEW → APPROVED → PAID
                          │
                          └──▶ DENIED → CLOSED
```

### 10.3 Transitions

**`COVERED → CLAIMED`** — Insured SubID submits evidence.

**`CLAIMED → REVIEW`** — Vault validates: claim metadata, evidence hashes, timestamps.

**`REVIEW → APPROVED`** — TX: 1 multi-output payout.

**`REVIEW → DENIED`** — Claim closed. No TX.

### 10.4 Reputation Effects

- Valid claim approval → neutral or positive (provider)
- Fraudulent claim → negative `baseDelta`

## 11. TrustBondVault Specification

TrustBondVault manages slashing and collateralisation for high-risk roles. It executes deterministic slashing only. It does NOT mutate RI directly.

### 11.1 Roles

- Bond Owner (any SubID holding a TrustBond)

### 11.2 Slashing Triggers

- Fraudulent service evidence
- Fraudulent challenge proof
- Loan default
- Invalid insurance claim
- Repeated dispute loss history

### 11.3 Slashing Rules

- Deterministic — no discretion
- Proportional to infraction category, not exposure size
- Proceeds paid to counterparty or burned per governance rules
- All slashing emits receipt and `baseDelta` routed to Reputation Engine

## 12. Metadata Schemas (BER)

Each Vault contract type MUST define BER metadata files. Core required fields for all Vault metadata:

```
schema_version     (u8 or u16)
checksum           (u32)
state              (enum — FSM state)
role_ids           (SubID references)
timestamps         (u64 — all on-chain injected, deterministic)
evidence_hashes    (hash32 references)
receipt_ids        (receipt reference array)
payout_map         (for multi-output TX)
transition_history (ordered FSM record)
```

Workers MUST reject metadata if: checksum mismatch, version mismatch, invalid state transition, or required fields missing.

## 13. Security Rules

All Vaults MUST enforce:

1. SubID permission checking (pre-Phantom)
2. TrustBond verification (where required)
3. Timestamp boundary enforcement — all timestamps on-chain injected
4. Fee-aware minimum pricing
5. Deep-link sanitisation (no auto-execution)
6. Worker-only metadata decoding
7. UI blocking of double actions during pending TX
8. Evidence immutability

## 14. Failure & Recovery

All Vaults MUST define:

- How rejected evidence is handled
- How slashed states finalise
- How refunds work
- Timeout-based auto-resolution
- Metadata recovery paths (Worker-triggered)
- Transaction retry logic for pending and cancelled TXs

## 15. Forward Compatibility

Each Vault contract MUST support:

- Optional metadata fields
- Future Worker APIs
- New payout strategies
- New evidence types
- Governance-approved SubID expansion

Breaking FSM changes require: major version increment, governance approval, and explicit supersession reference. No breaking changes to existing FSMs are permitted without these gates.

## 16. Diagrams

### 16.1 Vault Families Overview

```
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│ ActivationVault │  │  TradeVault  │  │  StoreVault  │
└─────────────────┘  └──────────────┘  └──────────────┘

┌─────────────────┐  ┌────────────────┐  ┌──────────────┐
│  ServiceVault   │  │ ChallengeVault │  │ LendingVault │
└─────────────────┘  └────────────────┘  └──────────────┘

┌─────────────────┐  ┌─────────────────┐
│ InsuranceVault  │  │ TrustBondVault  │
└─────────────────┘  └─────────────────┘
```

### 16.2 Generic Vault FSM

```
IDLE
  │
  ▼
OPEN / START
  │
  ▼
SUBMITTED (evidence)
  │
  ▼
REVIEW
  │
  ├── approve ──▶ PAID ──▶ CLOSED
  │
  └── reject ──▶ VAULT_EVALUATION
                      │
                      ▼
               FINAL / SLASH / REFUND ──▶ CLOSED
```

### 16.3 ServiceVault FSM (Detailed)

```
OPEN
  │
  ▼
ACCEPTED (Provider)
  │
  ▼
PROVIDER_SUBMITTED (evidence uploaded)
  │
  ▼
REQUESTER_REVIEW
  │
  ├── APPROVE ──▶ PAID ──▶ CLOSED
  │
  └── REJECT ──▶ DISPUTE
                    │
                    ▼
             VAULT_EVALUATION (deterministic)
                    │
                    ▼
      PAY_PROVIDER / REFUND / SLASH ──▶ CLOSED
```

### 16.4 ChallengeVault FSM

```
OPEN (ACTIVE)
  │
  ▼
ENTERED (entry TX)
  │
  ▼
SUBMITTED (proof)
  │
  ▼
VERIFIED (Vault logic)
  │
  ├──▶ WON  ─┐
  └──▶ LOST  ─┤  (multiple winners allowed)
              ▼
           CLOSED (multi-winner payout TX)
```

### 16.5 LendingVault FSM

```
INIT
  │
  ▼
COLLATERAL_LOCKED (borrower locks)
  │
  ▼
ACTIVE (loan ongoing)
  │
  ├── REPAID ──▶ (logical CLOSED)
  │
  └── DEFAULTED
          │
          ▼
     LIQUIDATED ──▶ (logical CLOSED)

Terminal encoded states: REPAID, LIQUIDATED
CLOSED = logical archival condition only
```

### 16.6 InsuranceVault FSM

```
COVERED
  │
  ▼
CLAIMED (evidence)
  │
  ▼
REVIEW
  │
  ├── approve ──▶ PAID ──▶ CLOSED
  └── deny    ──▶ CLOSED
```

### 16.7 TrustBondVault Slashing Flow

```
TrustBond Locked
  │
  │  Trigger Event:
  │    - Fraud detected
  │    - Invalid evidence
  │    - Repeated defaults
  │
  ▼
VAULT_EVALUATION (deterministic check)
  │
  ▼
SLASH / REDUCE BOND + update reputation (baseDelta → Reputation Engine)
  │
  ▼
FINAL STATE
```

### 16.8 Multi-Recipient Payout Structure

```
Vault Computes Payout
  │
  ▼
ONE MULTI-RECIPIENT TX
  ├── Seller        → X GNC
  ├── Provider      → Y GNC
  ├── Sponsor       → Z GNC
  ├── Treasury      → T GNC
  ├── Winner #1     → W1 GNC
  └── Winner #2     → W2 GNC
```

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Full Reference
**Last Reviewed:** 2026-02
**Supersedes:** GCSPEC v1.0
**Companion document (spine):** `/docs/runtime/contract-specification-gcspec-v1.1.md`
**Requires:**
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/identity/reputation-stake-governance-v1.0.md`
