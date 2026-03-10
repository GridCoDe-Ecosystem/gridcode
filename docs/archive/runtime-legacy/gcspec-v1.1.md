---
title: GridCoDe Contract Specification (GCSPEC)
version: v1.1
status: Active Binding
domain: Core
layer: Contract Spine
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: GCSPEC v1.0
requires:
  - /docs/runtime/runtime-execution-architecture-v1.1.md
  - /docs/identity/subid-role-technical-spec-v1.2.md
  - /docs/identity/reputation-stake-governance-v1.0.md
last_reviewed: 2026-02
---

# GridCoDe Contract Specification (GCSPEC)

## 1. Purpose

GCSPEC v1.1 defines the complete behaviour of all GridCoDe Vault contract families.

Vaults are static, deterministic, non-programmable, Worker-validated, Phantom Mode gated, and executed via one-transaction-per-value-mutation discipline.

Vaults are not smart contracts. They are deterministic state machines executed within Gridnet OS.

## 2. Global Contract Invariants (All Vaults)

These invariants apply to every Vault without exception.

### 2.1 Deterministic FSM Only

Each Vault is a closed finite-state machine.

- No dynamic branching
- No runtime code injection
- No ambiguous transitions
- No programmable logic extensions

### 2.2 One Transaction Per Value Mutation

Every value-mutating transition MUST map to exactly one transaction. Non-value transitions require no transaction. Multi-party payouts MUST use multi-output TX.

### 2.3 Worker-Validated Metadata

All metadata MUST:

- Be BER encoded
- Include `schema_version`
- Include `checksum`
- Be normalised by Worker
- Pass Phantom Mode simulation
- Match deterministic FSM rules

Invalid metadata MUST be rejected before execution.

### 2.4 Phantom Mode Required

Before signing, the following sequence MUST complete in order:

1. Metadata loaded
2. Worker validation executed
3. FSM evaluated
4. Exact TX simulated
5. Output shown to signer
6. User signs

No direct execution without Phantom validation.

### 2.5 SubID Enforcement

All actions require a canonical SubID. No Vault may introduce new SubID classes. All enforcement references:

`/docs/identity/subid-role-technical-spec-v1.2.md`

### 2.6 Reputation Mutation Rule

All reputation updates MUST follow the canonical path:

```
Vault FSM → baseDelta → Reputation Engine scaling
```

No Vault directly mutates RI. No alternate mutation channels are permitted.

### 2.7 Dispute Determinism

Disputes MUST resolve via: defined FSM states, evidence hash comparison, timeout rules, and deterministic outcome mapping. No subjective arbitration. No discretionary override.

## 3. Canonical Vault Families

GridCoDe defines eight Vault families. No additional Vault families exist in Tier-1.

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

## 4. Vault Template Requirements (Uniform)

Each Vault specification MUST define:

1. Roles
2. States
3. Transition Table
4. Deterministic Conditions
5. Reputation Effects
6. TrustBond Interaction (if applicable)
7. Failure and Timeout Rules

This ensures structural uniformity across all Vault families.

## 5. ActivationVault

Authoritative specification: `/docs/contracts/grid-activation-contract-spec-v1.0.md`

### Roles

- `SponsorID`

### States

```
INIT → ACTIVATING → ACTIVE → FINALIZING → EXPIRED
```

### Value Rules

- Activation stake lock → 1 TX
- Yield distribution → 1 multi-output TX

### Reputation Effects

- Successful activation epochs → positive `baseDelta`
- Failed activation conditions → none (no value mutation)

## 6. TradeVault

Authoritative specification: `/docs/contracts/trade-offer-contract-spec-v1.0.md`

### Roles

- `TraderID` (maker and taker)

### States

```
INIT → ACTIVE → PARTIAL* → FILLED
          │
          └──▶ CANCELLED
          └──▶ EXPIRED
```

### Value Rules

- Offer creation → 0 TX (metadata only)
- Settlement → 1 multi-output TX (maker, taker, sponsor, treasury)

### Reputation Effects

- Completed trades → positive `baseDelta` (both parties)
- Fraud or disputed settlement → negative `baseDelta`

TradeVault enforces `give_asset ≠ want_asset`. Self-trade loops prohibited.

## 7. StoreVault

Authoritative specification: `/docs/core/store-protocol-v1.0.md`

### Roles

- `SellerID`
- Buyer (grid-permitted SubID)
- `SYSTEM` (Vault context only)

### Reputation Effects

- Finalised fulfilment → positive `baseDelta` (seller)
- Proven fraud → negative `baseDelta`
- Dispute abuse → scaled penalty

StoreVault does not override SubID rules.

## 8. ServiceVault

### Roles

- `ProviderID`
- Funding SubID (escrow originator)

No `RequesterID` class exists.

### Deterministic Role Binding

```
funding_subid  == escrow_originator
provider_subid == accepted_provider
```

### Reputation Effects

- Approved completion → positive `baseDelta` (provider)
- Fraud → negative `baseDelta` + TrustBond slash

TrustBondVault executes slashing.

## 9. ChallengeVault

Authoritative specification: `/docs/contracts/challenge-creation-contract-spec-v1.0.md`

### Roles

- `CreatorID` (shard tenant host)
- `ParticipantID` (entry-layer only; no tenancy, no stake lock, no weight)

### States

```
INIT → ACTIVE → ENDED → CLOSED
          │
          └──▶ EXPIRED → CLOSED
```

### Value Rules

- Reward pool lock → 1 TX (at creation)
- Multi-winner payout → 1 multi-output TX

### Reputation Effects

- Verified participation → positive `baseDelta`
- Fraudulent proof → negative `baseDelta`

`ParticipantID` remains entry-layer only. It does not hold shard tenancy, lock stake, or register yield weight.

## 10. LendingVault

Authoritative specification: `/docs/contracts/loan-contract-spec-v1.0.md`

### Roles

- `BorrowerID`
- `LenderID`

### States

```
INIT → COLLATERAL_LOCKED → ACTIVE → REPAID
                                │
                                └──▶ DEFAULTED → LIQUIDATED
```

`REPAID` and `LIQUIDATED` are terminal encoded states. `CLOSED` is a logical archival condition only — it is not a distinct encoded status value.

### Value Rules

- Collateral lock → 1 TX
- Loan disbursement → 1 TX
- Repayment → 1 multi-output TX
- Liquidation → 1 multi-output TX

### Reputation Effects

- Successful repayment → positive `baseDelta`
- Default → negative `baseDelta`
- Liquidation → scaled penalty

## 11. InsuranceVault

### Roles

- `ProviderID`
- Policy-holding SubID

No `InsuredID` class exists.

### Determinism

Claims resolved via: evidence hash, timeout rules, deterministic payout logic.

### Reputation Effects

- Valid claim approval → neutral or positive (provider)
- Fraudulent claim → negative `baseDelta`

## 12. TrustBondVault

TrustBondVault executes deterministic slashing only. It does NOT mutate RI directly.

### Slashing Triggers

- Proven fraud
- Loan default
- Repeated dispute loss
- Invalid claim
- Service misconduct

### Rule

Slashing is proportional to infraction category, not exposure size. All slashing emits receipt and `baseDelta` routed to Reputation Engine.

## 13. Metadata Requirements (All Vaults)

All Vaults MUST include the following minimum metadata fields:

```
schema_version
checksum
state
role_ids
timestamps
evidence_hashes
receipt_ids
payout_map
transition_history
```

Worker MUST reject if: version mismatch, checksum mismatch, invalid transition, or required fields missing.

## 14. Security Requirements

All Vaults MUST enforce:

1. SubID permission check (pre-Phantom)
2. TrustBond verification (where required)
3. Timestamp boundary enforcement
4. Fee minimum enforcement
5. Deep-link sanitisation
6. Worker-only metadata decoding
7. UI lock during pending TX
8. Evidence immutability

## 15. Failure & Recovery

Vaults MUST define:

- Evidence rejection rules
- Refund mapping
- Timeout auto-resolution
- Slashed-state finalisation
- Metadata recovery procedure
- Transaction retry logic

## 16. Forward Compatibility

Vaults MUST support:

- Optional metadata fields
- Extended evidence types
- Governance-approved SubID expansion
- Non-breaking payout extensions

Breaking FSM changes require: major version increment, governance approval, and explicit supersession reference.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** GCSPEC v1.0
**Requires:**
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/identity/reputation-stake-governance-v1.0.md`
