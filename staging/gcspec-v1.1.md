---
title: GridCoDe Contract Specification (GCSPEC)
version: v1.1
status: Active Binding
domain: Runtime
layer: Vault Contract Taxonomy
environment: Gridnet OS
authoritative: true
---

# GridCoDe Contract Specification (GCSPEC)

## 1. Purpose

GCSPEC v1.1 defines the complete behaviour of all GridCoDe contract types, implemented as deterministic Vault state machines, executed through Worker-validated metadata, and gated by Phantom Mode simulation.

This specification eliminates ambiguity by defining for each Vault:

- Allowed states
- Allowed transitions (always 1 TX per transition)
- Metadata requirements
- SubID role permissions
- Evidence rules
- Payout logic
- Security constraints
- Failure handling
- Multi-recipient transaction behaviour

GCSPEC does NOT define smart contracts. GridCoDe Vaults are static, deterministic execution engines, not programmable on-chain code.

## 2. Core Principles (All Vaults)

### 2.1 Deterministic State Machines

Every contract type is implemented as a finite-state machine (FSM). No branching logic beyond what is defined here. No runtime code injection. No programmable behaviour. No ambiguity in transitions.

### 2.2 One Transaction Per Transition

Each transition that mutates value MUST map to exactly one value-transfer transaction. Evidence submission and review transitions that do not transfer value require no TX. All value-transfer transitions remain strictly 1 TX.

### 2.3 Worker-Validated Metadata

All contract metadata MUST:

- Be stored in BER format
- Include `version` and `checksum` fields
- Be decoded, normalised, and validated by a Worker
- Match Phantom Mode expectations

### 2.4 Phantom Mode Simulation Required

Before any contract step executes: metadata is loaded, Worker validates it, Phantom Mode simulates the exact outcome, and only after success MAY the user sign the transaction.

### 2.5 SubID Identity Enforcement

Each contract defines required roles. A SubID CANNOT perform an action if it lacks the required permissions. See `/docs/governance/subid-role-spec-v1.2.md`.

### 2.6 Multi-Recipient Transactions Mandatory

Any payout involving more than one party MUST use a multi-output TX.

### 2.7 Receipts Are First-Class Evidence

Each transaction generates a receipt. Receipts serve as evidence, proof of actions, dispute anchors, and binding metadata references.

### 2.8 Disputes Are Deterministic

All contract types with disputes MUST resolve them through Vault-defined FSM, evidence evaluation rules, timeout logic, and TrustBond slashing rules. No subjective arbitration.

## 3. Contract Types

GridCoDe defines eight Vault contract families:

| # | Vault | Domain |
|---|---|---|
| 1 | ActivationVault | Grid activation and epoch management |
| 2 | TradeVault | Peer-to-peer asset trading |
| 3 | StoreVault | Escrow-based product commerce |
| 4 | ServiceVault | Human-performed task execution |
| 5 | ChallengeVault | Proof-based competitions |
| 6 | LendingVault | Collateralised loans |
| 7 | InsuranceVault | Deterministic claim processing |
| 8 | TrustBondVault | Collateral staking and slashing |

## 4. ActivationVault Specification

### 4.1 Roles

- `SponsorID`

### 4.2 States

```markdown
INIT → ACTIVATING → ACTIVE → FINALIZING → EXPIRED
```

### 4.3 Transition Table

| From | Action | To | Role | Notes |
|---|---|---|---|---|
| INIT | activate | ACTIVATING | SponsorID | RI threshold, stake, seed availability |
| ACTIVATING | lock_stakes | ACTIVE | Vault | Checksum, balance lock |
| ACTIVE | finalize_epoch | FINALIZING | Vault | Epoch timer reached |
| FINALIZING | distribute_yield | EXPIRED | Vault | Payout map, multi-output TX |
| EXPIRED | reactivate | ACTIVATING | SponsorID | Same as initial activation |

## 5. StoreVault Specification

See `/docs/store/protocol-v1.0.md` for the full StoreVault specification and `/docs/store/fsm-matrix-v1.0.md` for the complete transition matrix. Both documents are Tier-1 stabilised.

### 5.1 Roles

- `SellerID`
- Buyer SubID (assigned at PURCHASE; any SubID permitted to purchase under grid policy)
- SYSTEM (Vault authority — not a SubID class; adapter-controlled privileged context)

### 5.2 States

```markdown
LISTED → PURCHASED → FULFILLED → (terminal)
                  → DISPUTED → FULFILLED (terminal)
                             → CANCELLED (terminal)
         → CANCELLED (terminal)
```

## 6. ServiceVault Specification

ServiceVault manages escrow-based human task execution where one party funds a task and another performs it.

### 6.1 Roles

- `ProviderID`
- Funding SubID (any SubID authorised to fund services under grid policy)

"Requester" is not a SubID class. "Requester" refers to the SubID that originated the escrow for the service. The funding SubID MAY be `CreatorID`, `SponsorID`, `SellerID`, `ParticipantID`, or any other SubID permitted by the governing Grid type. No dedicated `RequesterID` exists in the canonical SubID set. Workers enforce role eligibility via SubID permission matrix and RI thresholds.

### 6.2 States

```markdown
OPEN → ACCEPTED → PROVIDER_SUBMITTED → REQUESTER_REVIEW
  → APPROVED → PAID → CLOSED
  → REJECTED → DISPUTE → RESOLVED → CLOSED
```

### 6.3 Transition Table

| From | Action | To | Role | TX |
|---|---|---|---|---|
| OPEN | accept | ACCEPTED | ProviderID | Optional Provider TrustBond |
| ACCEPTED | submit_evidence | PROVIDER_SUBMITTED | ProviderID | No TX |
| PROVIDER_SUBMITTED | review | REQUESTER_REVIEW | Funding SubID | No TX |
| REQUESTER_REVIEW | approve | APPROVED | Funding SubID | Multi-output payout; TrustBond returned |
| REQUESTER_REVIEW | reject | DISPUTE | Funding SubID | No TX |
| DISPUTE | resolve | RESOLVED | Vault | PAY_PROVIDER or REFUND_REQUESTER or SLASH_PROVIDER via 1 TX |

### 6.4 Deterministic Role Binding

Workers enforce:

```
funding_subid == escrow_originator
provider_subid == accepted_provider
```

Only the escrow-originating SubID may approve or reject. Role checks occur before Phantom Mode simulation.

### 6.5 Reputation Effects

All reputation changes occur strictly via ServiceVault FSM → baseDelta → Reputation Engine scaling. No role independently mutates RI.

- Provider success → positive baseDelta
- Proven fraudulent submission → negative baseDelta
- Wrongful rejection → negative baseDelta (Funding SubID)
- TrustBond slashing → deterministic baseDelta

### 6.6 TrustBond Integration

If ServiceVault requires TrustBond: provider stake MUST be locked during ACCEPTED state. Slashing triggers a deterministic baseDelta routed through the Governance Engine. TrustBondVault remains the sole slashing executor.

### 6.7 Identity Integrity Guarantee

ServiceVault does NOT introduce new SubID classes, role-specific RI ledgers, alternate mutation channels, or contract-level identity overrides. All identity enforcement follows `/docs/governance/subid-role-spec-v1.2.md`.

## 7. ChallengeVault Specification

### 7.1 Roles

- `CreatorID`, `ParticipantID`

### 7.2 States

```markdown
OPEN → ENTERED → SUBMITTED → VERIFIED → WON / LOST → CLOSED
```

### 7.3 Transition Table

| From | Action | To | Role | TX |
|---|---|---|---|---|
| OPEN | enter | ENTERED | ParticipantID | Entry fee |
| ENTERED | submit_proof | SUBMITTED | ParticipantID | No TX |
| SUBMITTED | verify | VERIFIED | Vault | Deterministic rule evaluation |
| VERIFIED | award | WON or LOST | Vault | Multi-winner payout via 1 TX |

## 8. LendingVault Specification

### 8.1 Roles

- `BorrowerID`, `LenderID`

### 8.2 States

```markdown
INIT → COLLATERAL_LOCKED → ACTIVE → REPAID → CLOSED
                                  → DEFAULT → LIQUIDATED → CLOSED
```

### 8.3 Transition Table

| From | Action | To | Role | TX |
|---|---|---|---|---|
| INIT | lock_collateral | COLLATERAL_LOCKED | BorrowerID | Collateral lock |
| COLLATERAL_LOCKED | fund_loan | ACTIVE | LenderID | Loan disbursement |
| ACTIVE | repay | REPAID | BorrowerID | Repayment TX; collateral released |
| ACTIVE | default | DEFAULT | Vault | Triggered by expiration |
| DEFAULT | liquidate | LIQUIDATED | Vault | Collateral sold; proceeds distributed |

## 9. InsuranceVault Specification

### 9.1 Roles

- `ProviderID`
- Funding SubID (the policy-holding SubID — any SubID authorised to hold insurance under grid policy)

"Insured" is not a SubID class. "Insured" refers to the SubID that originated the insurance policy. The policy-holding SubID MAY be `CreatorID`, `SponsorID`, `BorrowerID`, `ParticipantID`, or any other SubID permitted by the governing Grid type. No dedicated `InsuredID` exists in the canonical SubID set. Workers enforce role eligibility via SubID permission matrix and RI thresholds.

### 9.2 States

```markdown
COVERED → CLAIMED → REVIEW → APPROVED → PAID → CLOSED
                           → DENIED → CLOSED
```

### 9.3 Transition Table

| From | Action | To | Role | TX |
|---|---|---|---|---|
| COVERED | submit_claim | CLAIMED | Funding SubID | Evidence hash |
| CLAIMED | review | REVIEW | Vault | Metadata validation |
| REVIEW | approve | APPROVED | Vault | Multi-output payout |
| REVIEW | deny | DENIED | Vault | No TX |

## 10. TrustBondVault Specification

TrustBondVault manages slashing and collateralisation for high-risk roles.

### 10.1 Roles

- BondOwner (the SubID that locked collateral into TrustBondVault)

"BondOwner" is not a canonical SubID class. It refers to the SubID that initiated and owns the bond position. The BondOwner MUST be one of the canonical SubIDs defined in `/docs/governance/subid-role-spec-v1.2.md` — for example `ProviderID` (service bond), `BorrowerID` (loan collateral), or `SellerID` (store reputation bond). Workers enforce role eligibility before bond operations execute.

### 10.2 Slashing Triggers

- Fraudulent service evidence
- Fraudulent challenge proof
- Loan default
- Invalid insurance claim
- Repeated dispute loss history

### 10.3 Slashing Rules

Slashing is deterministic, proportional to infraction category (not exposure size), paid to counterparty or redistributed, and emits a receipt. TrustBondVault emits a deterministic baseDelta routed through the Reputation Engine for velocity scaling — it does not directly mutate RI. See `/docs/governance/reputation-stake-governance-v1.0.md` for fixed penalty model and baseDelta routing rules.

## 11. TradeVault Specification

### 11.1 Roles

- `TraderID` (both parties)

### 11.2 States

```markdown
OPEN → MATCHED → ESCROWED → COMPLETED → CLOSED
                           → DISPUTED → RESOLVED → CLOSED
```

### 11.3 Principles

- Both parties commit asset metadata via Workers
- Vault escrows both assets atomically
- On match confirmation, single multi-output TX releases both assets to counterparties
- Disputes resolved deterministically via evidence evaluation

## 12. Metadata Schemas (BER)

Each Vault contract type MUST define metadata files containing at minimum:

```markdown
schema_version  (uint8 / uint16)
checksum        (uint32)
state           (enum)
role_ids        (SubID references)
timestamps      (created_at, last_updated)
evidence_hashes (hash32[])
receipt_ids     (reference array)
payout_map      (for multi-output TX)
transition_history
```

Workers MUST reject metadata if: checksum mismatch, version mismatch, state transitions invalid, or required fields missing.

## 13. Security Rules

All contracts MUST enforce:

1. SubID permission checking (Workers before Phantom Mode)
2. TrustBond verification where required
3. Timestamp enforcement (boundary-based, not rate-based)
4. Fee-aware minimum pricing (`minListingPriceGNC`)
5. Deep-link sanitisation (no auto-execution)
6. Worker-only metadata decoding
7. UI blocking of double actions during pending TX
8. Evidence immutability (hash-anchored)

## 14. Failure & Recovery

All Vaults MUST define:

- How rejected evidence is handled
- How slashed states finalise
- How refunds are executed
- Timeout-based auto-resolution rules
- Metadata recovery paths (Worker-triggered)
- Transaction retry logic for pending / cancelled TXs

## 15. Forward Compatibility

Each Vault contract MUST support:

- Optional metadata fields (backward compatible)
- Future Worker APIs
- New payout strategies
- New evidence types
- Extended SubID roles via governance-approved update to `/docs/governance/subid-role-spec-v1.2.md`

Breaking changes to existing FSMs require a major version increment and explicit governance approval. Backward-compatible extensions do not require version increment.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier 1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** GCSPEC v1.0
**Requires:**
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/governance/subid-role-spec-v1.2.md`
