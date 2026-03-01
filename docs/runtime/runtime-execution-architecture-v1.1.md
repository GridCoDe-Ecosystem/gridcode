---
title: GridCoDe Runtime Execution Architecture
version: v1.1
status: Active Binding
domain: Runtime
layer: Execution Architecture
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: Runtime Architecture v1.0
requires:
  - /docs/runtime/contract-specification-gcspec-v1.1.md
  - /docs/runtime/state-domain-contract-storage-guide-v1.2.md
  - /docs/identity/subid-role-technical-spec-v1.2.md
last_reviewed: 2026-02
---

# GridCoDe Runtime Execution Architecture

**v1.1** — Aligned with Whitepaper v3.0 (Architecture Layer) and Whitepaper v3.1 (Technical Execution Addendum)

This v1.1 supersedes the previous Runtime Architecture draft. It is fully aligned with Gridnet OS execution model as of v3.1.

## 1. Introduction

GridCoDe operates entirely at the dApp layer, above Gridnet OS's consensus and protocol logic.

Its runtime is powered by:

- **Workers** (metadata parsing, validation, indexing)
- **State-Domain** (persistent structured data)
- **Vaults** (deterministic economic state machines)
- **Phantom Mode** (safe, deterministic transaction simulation)
- **Wallet OS** (TX signing, pending state handling, confirmations)

GridCoDe does NOT introduce:

- protocol changes
- on-chain programmatic smart contracts
- oracles
- consensus-level staking

All execution occurs via UI-driven actions, Worker-validated metadata updates, and Vault-enforced deterministic transitions.

This document defines the exact runtime behavior for GridCoDe v3.0/v3.1.

## 2. System Overview

GridCoDe runtime is composed of:

### 2.1 Frontend UI Layer

- Displays grids, shards, listings, services, trades, and challenges
- Issues user actions (accept, submit, repay, buy, create)
- Connects SubID identities to Vault operations
- Loads views via deep-links

### 2.2 Worker Layer

Workers are sandboxed threads responsible for:

- decoding BER metadata
- verifying schema versions
- validating checksums
- indexing marketplace items
- preparing metadata for Phantom Mode
- loading thumbnails, summaries, and grid/shard trees

Workers guarantee: performance, safety, determinism.

No metadata is ever handled directly by the UI.

### 2.3 Metadata Layer (State-Domain Storage)

Each grid, shard, listing, vault, or challenge owns specific metadata files:

- grid-meta.ber
- shard-meta.ber
- listing.ber
- service-task.ber
- challenge-state.ber
- vault-state.ber
- reputation.ber

Each file:

- MUST include a schema version
- MUST include a checksum
- MUST be decoded by Workers only
- MUST be simulation-compatible

### 2.4 Vault Layer (Deterministic FSMs)

Vaults are not programmable contracts. They are static, deterministic state machines defined by GridCoDe.

Vaults:

- simulate transitions in Phantom Mode
- execute via a single transaction per step
- update metadata atomically
- validate permissions via SubID
- emit receipts
- support multi-recipient payouts
- guarantee reproducible results

Vaults include:

- TradeVault
- StoreVault
- ServiceVault
- ChallengeVault
- LendingVault
- InsuranceVault
- ActivationVault
- TrustBondVault

### 2.5 Wallet OS Layer

The Wallet manages:

- nonce sequencing
- mempool stacking
- fee selection
- transaction dispatch
- pre-confirmation receipt generation
- confirmation state updates
- deep-link application routing

## 3. Deep-Link Invocation Runtime

GridCoDe supports OS-level deep linking via schema:

```
gridcode://<target>/<id>?params
```

`gridcode://` is the canonical prefix. `gcd://v1/` is deprecated — accepted as a legacy alias during transition only.

### 3.1 Deep-Link Runtime Flow

```
Deep-Link Received →
Worker validates schema →
Identity/SubID check →
Worker loads metadata →
Phantom Mode (read-only) →
Render UI →
User must trigger any TX manually
```

No deep-link may dispatch a transaction or circumvent SubID gatekeeping.

## 4. Nonce, Mempool & Transaction Sequencing Model

Gridnet OS enforces strict sequential transaction order per identity (SubID).

### 4.1 Nonce Model

```
effective_nonce = actual_nonce + pending_tx_count
```

GridCoDe must never attempt concurrent actions from the same SubID.

### 4.2 Pending Transaction States

TX lifecycle:

```
Phantom Simulation → TX Signed → TX Pending → On-Chain Confirmation → State-Domain Commit → Worker Re-Index
```

UI must:

- lock buttons during pending state
- show "Awaiting Confirmation"
- prevent double acceptance / double submissions

## 5. Phantom Mode Execution (The Deterministic Firewall)

Phantom Mode simulates all Vault transitions before they are signed.

### 5.1 Requirements

Phantom Mode must:

- use Worker-validated metadata only
- confirm SubID permissions
- calculate exact post-execution metadata
- ensure no illegal transitions occur
- reject stale or corrupted metadata

### 5.2 Failure Conditions

Simulation must fail when:

- metadata mismatch occurs
- role permissions insufficient
- nonce inconsistent
- illegal state transition attempted

No TX is allowed to be signed if simulation fails.

## 6. Vault Execution Model (Deterministic FSMs)

Each Vault defines a Finite State Machine. Example: ServiceVault.

**ServiceVault FSM**

```
OPEN
→ ACCEPTED
→ PROVIDER_SUBMITTED
→ REQUESTER_REVIEW
→ (APPROVE → PAID)
→ (REJECT → DISPUTE → RESOLVED → CLOSED)
```

All Vaults constrain logic similarly.

### 6.1 Vault Invariants

Each Vault guarantees:

- single transaction per step
- deterministic outcome
- SubID-specific authorization
- no ambiguous states
- atomic metadata update

All arithmetic inside Vault simulation SHALL use fixed-point integer arithmetic. Floating-point operations are prohibited.

SubID execution MUST be serialized. Parallel dispatch from the same SubID is prohibited.

### 6.2 Multi-Recipient Payout Requirement

Payout distributions must use a single TX with multiple outputs.

## 7. Metadata Processing Pipeline

All runtime state flows through the Worker-managed metadata lifecycle:

```
State-Domain File →
Worker Decode →
Worker Validate →
Worker Normalize →
Simulation →
UI Render →
Vault TX →
State Update →
Worker Re-Index
```

Metadata must be: atomic, versioned, checksummed, deterministic.

## 8. Market Indexing & Performance Model

To operate efficiently, GridCoDe must:

- paginate markets (20–30 items at a time)
- use Worker-based indexing
- lazy-load thumbnails
- avoid synchronous decoding
- only load visible metadata

Workers maintain indexes for: Grids, Shards, Listings, Challenges, Services.

UI renders only Worker-produced summaries.

## 9. Receipts as First-Class Evidence

Receipts in GridCoDe are two distinct objects and MUST NOT be conflated:

**OS Receipts** — generated by Gridnet OS upon TX dispatch and updated at confirmation. They prove transaction inclusion on-chain. They exist in states: Pending, Confirmed, Replaced/Failed. Workers bind OS receipts to actions.

**Vault Receipts** — generated by Vault logic at simulation and commit time. They record deterministic FSM transitions, payout maps, and metadata diff hashes. They are the economic and legal record of a Vault state change.

GridCoDe MUST use both receipt types for:

- service acceptance
- challenge entry
- trade and escrow formation
- lending repayments
- insurance submissions
- payout proofs
- dispute evidence
- slashing justification

## 10. Dispute Resolution (Deterministic)

Vaults handle all disputes deterministically.

**ServiceVault Dispute FSM**

```
EVIDENCE_SUBMITTED →
REQUESTER_REVIEWS →
REJECT →
DISPUTE →
VAULT_EVALUATION →
(PAY_PROVIDER or REFUND_REQUESTER or SLASH)
```

**ChallengeVault FSM** — Evaluate proof, auto-resolve on timeout, multi-winner payouts in one TX.

**LendingVault FSM** — Repay or liquidate, no subjective arbitration.

**InsuranceVault FSM** — Claim → verify → payout/refusal.

All are deterministic.

## 11. Fee-Aware Workflow Design

To keep micro-markets profitable:

- avoid multi-step TX flows
- batch payouts
- use metadata updates where possible
- enforce minimum job pricing
- reduce redundant Vault calls

GridCoDe runtime must minimize TX count.

## 12. Security Model

Runtime must enforce:

- SubID permission gating
- no auto-execution from deep-links
- confirmation dialogs for every TX
- Worker-only metadata use
- TX simulation gating
- dispute timeline enforcement
- anti-spam constraints (listing limits)
- TrustBond slashing only via vaults

All external references are treated as unsafe.

## 13. Forward Compatibility

GridCoDe Runtime must remain stable across OS upgrades.

Must support:

- new Worker types
- metadata field extensions
- deep-link schema versions
- enhanced Phantom Mode capabilities
- new Vault categories

Design rules:

- ignore unknown metadata fields
- maintain backward compatibility
- detect OS version at runtime
- fallback gracefully

## 14. Full Execution Diagram

```
User Action
↓
Deep-Link or UI Navigation
↓
Worker Decodes Metadata
↓
Phantom Mode Simulation  ← Vault FSM logic applied here
↓ (valid)
Wallet Shows TX Summary
↓
TX Signed
↓
TX Pending (OS pending receipt)
↓
Nonce Progression
↓
On-Chain Confirmation
↓
State-Domain Commit      ← metadata written; Vault receipt generated
↓
Worker Re-Index
↓
UI Updates (final state, payouts)
```

> Vault logic is applied during Phantom Mode simulation (pre-sign), not as a post-confirmation agent. After on-chain confirmation, the Worker commits the pre-determined state change to the State-Domain and generates the Vault receipt. The Vault does not execute as a runtime system after confirmation — the outcome was deterministically established during simulation.

**Step-by-Step:**

**Step 1 — User Action** (UI click or deep link)

**Step 2 — Worker Loads & Validates Metadata**
- BER decode
- Version check
- Checksum validation

**Step 3 — Phantom Mode Simulation**
- Deterministic pre-execution
- Role & state verification
- Failure halts execution

**Step 4 — Wallet Signing (User)**
- Review TX
- Confirm fee
- Explicit approval

**Step 5 — TX Dispatch (Pending Receipt)**
- Mempool stacking
- Nonce progression
- Receipt generated

**Step 6 — On-Chain Confirmation (Block)**
- TX confirmed
- OS receipt updated to Confirmed

**Step 7 — State-Domain Commit (Worker)**
- Pre-determined FSM transition written to State-Domain
- Vault receipt generated (records FSM transition, payout map, metadata diff)
- Multi-recipient payouts executed
- Vault does not execute post-confirmation as an independent agent; the outcome was determined in Phantom Mode

**Step 8 — Worker Re-Index & UI Refresh**
- Updated view
- Dispute / payout / completion

**Pending TX & Nonce Progression:**

```
Nonce: 12 (confirmed)
↓
TX#1 dispatched → Pending (nonce 13)
↓
TX#2 dispatched → Pending (nonce 14)
↓
Wallet proposes next nonce = 15
↓
TX#1 confirmed → nonce 13 now actual
TX#2 still pending → effective nonce: 14
```

GridCoDe runtime must obey serialized SubID execution.

**Multi-Recipient Payout Architecture:**

```
Vault Calculates Outputs
↓
ONE Transaction, Many Outputs
  Seller    → 3.4 GNC
  Sponsor   → 0.2 GNC
  Treasury  → 0.1 GNC
  Provider  → 1.0 GNC
  Winner#1  → 2.0 GNC
  Winner#2  → 1.5 GNC
```

This is mandatory for all Vault payout stages.

**Deep-Link Application State Machine:**

```
Deep-Link Received
↓
Validate Schema & Parameters
↓
Identity / SubID Check
↓
Worker Load Metadata
↓
Phantom Simulation (read-only)
↓
Render Target View
↓
(Action must come from user → No auto-exec)
```

---

This is the completed GridCoDe Runtime Execution Architecture v1.1.

It is: fully aligned with v3.0 (architecture), fully aligned with v3.1 (technical execution), compliant with Gridnet OS, ready for developer onboarding, ready for audit.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** Runtime Architecture v1.0
**Requires:**
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
- `/docs/runtime/state-domain-contract-storage-guide-v1.2.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
