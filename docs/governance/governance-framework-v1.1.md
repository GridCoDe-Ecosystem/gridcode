---
title: GridCoDe — Governance Framework
version: v1.1
status: Active Binding
domain: Governance
layer: Protocol Governance & Version Control
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Governance Framework

A Deterministic, Reputation-Aware, Multi-Layer Governance Model for the GridCoDe Ecosystem.

## 1. Purpose

This document defines:

- How GridCoDe transitions from Team-led governance to DAO governance
- How voting, proposals, and upgrades work
- How SubID roles influence governance
- How reputation, TrustBonds, and Treasury integrate into governance
- How market categories, fees, and parameters are governed
- How governance remains deterministic within Gridnet OS constraints

Governance does not modify Gridnet consensus. All logic remains at the dApp + Vault metadata + Worker level.

## 2. Governance Principles

GridCoDe governance rests on six foundation rules.

### 2.1 Deterministic Over Arbitrary

All governance actions must be:

- Reproducible
- Rule-based
- Deterministic
- Worker-validated

No human arbitration. No runtime ambiguity.

### 2.2 Metadata Over Code

Governance states live in:

- Governance metadata files
- Vault state
- Structured configuration objects

Governance does not rely on mutable smart contracts.

### 2.3 Reputation as Voting Weight Multiplier

Citizens with higher reputation have greater influence.

```
VP = stake_weight × reputation_multiplier
```

Reputation reduces sybil attacks and amplifies proven contributors.

### 2.4 SubID Role Segmentation

Governance actions may require a specific SubID role:

- Sponsor decisions
- Trader category rules
- Lender/Liquidity category rules
- Service/Seller category rules

Voting is never done by the CitizenNFT directly — only via active SubIDs.

### 2.5 Treasury as Economic Backbone

Treasury is:

- Fee collector
- Slashing collector
- Liquidity provider
- Staking reward distributor
- Governance budget source

Governance SHALL decide Treasury allocation.

### 2.6 Progressive Decentralization

Governance evolves in three phases:

1. Phase 0 — Team Governance
2. Phase 1 — Hybrid Governance with Reputation Weighting
3. Phase 2 — Full DAO Governance

GridCoDe SHALL progress through these phases as the ecosystem matures.

## 3. Governance Layers

Governance is structured across four deterministic layers:

| Layer | Scope |
|---|---|
| Layer 4 | Market Category Governance (Store, Service, Challenge, Trade, Lending, etc.) |
| Layer 3 | Treasury & Economic Parameter Control |
| Layer 2 | GridCoDe Protocol Governance (dApp) |
| Layer 1 | Identity & Reputation Layer (SubIDs) |

Each layer is controlled by specific Vaults and metadata rules.

## 4. Governance Entities

### 4.1 CitizenNFT Holder

The base identity. NOT used for voting directly.

### 4.2 SubIDs

Governance-relevant SubIDs:

- SponsorID
- TraderID
- SellerID
- CreatorID
- ProviderID
- LenderID
- BorrowerID
- ParticipantID

Voting occurs at the SubID level. This ensures specialised governance, not generic voting.

### 4.3 GovernanceVault

A deterministic FSM controlling:

- Proposals
- Voting
- Execution
- Outcome publishing

### 4.4 TreasuryVault

Holds:

- Fees
- Slashing income
- Marketplace shares
- Sponsor shares
- Liquidation margins

TreasuryVault is controlled by GovernanceVault decisions.

### 4.5 ReputationVault

Maintains:

- Trust score
- Delivery score
- Economic contribution score
- Dispute outcomes
- Slashing history

Voting weight depends on ReputationVault.

## 5. Governance Vault FSM

Governance decisions follow a deterministic state machine.

```
PROPOSAL_DRAFTED
  │
  ▼
PROPOSAL_ACTIVE (Voting Open)
  │
  ├── threshold met ──▶ PROPOSAL_PASSED
  │                         │
  └── threshold not met ──▶ PROPOSAL_FAILED
                            │
                            ▼
                    EXECUTION_PENDING
                            │
                            ▼
                    EXECUTED (metadata updated)
```

Each transition uses:

- One transaction
- Worker-validated metadata
- Phantom Mode simulation

No ambiguous outcomes are possible.

## 6. Types of Proposals

### 6.1 Market Parameter Proposals

Modify:

- Fee ratios
- Sponsor share rate
- Treasury share rate
- Grid activation prices
- Dispute timeout windows
- Category visibility weights

### 6.2 Treasury Allocation Proposals

Treasury MAY fund:

- Grants
- Liquidity reserves
- Marketing campaigns
- Category subsidies
- Reward pools (challenge grids)

### 6.3 Market Category Governance

Create, modify, or retire categories:

- Store
- Service
- P2P Trading
- Lending
- Insurance
- Challenge
- Education
- Governance
- Development

Categories define:

- UI grouping
- Vault mapping
- Reputation thresholds
- Allowed contract types
- Listing rules

### 6.4 Parameterised Vault Configuration

Governance MAY tune:

- TrustBond requirements
- Minimum price floors
- Slashing ratios
- Lending interest rates
- Insurance premium baselines

These are metadata changes, not protocol changes.

### 6.5 Economic & Treasury Policy

Treasury disbursement models:

- Staking reward allocation
- Category reward weighting
- DAO member compensation

## 7. Voting Power Model

Voting Power (VP) is defined as:

```
VP = StakeWeight × ReputationMultiplier × RoleCoefficient
```

### 7.1 StakeWeight

Amount staked in governance proposal.

### 7.2 ReputationMultiplier

Derived from:

- Delivery score
- Dispute history
- Completion rate
- Contribution score

### 7.3 RoleCoefficient

Each SubID has different governance power depending on proposal type:

| SubID | Coefficient | Proposal Type |
|---|---|---|
| SponsorID | 1.5× | Market category proposals |
| SellerID | 1.3× | Store category proposals |
| ProviderID | 1.3× | Service category proposals |
| TraderID | 1.2× | Trade category proposals |
| LenderID | 1.4× | Lending category proposals |
| ParticipantID | 1.1× | Challenge category proposals |
| All SubIDs | 1.0× | Treasury-related proposals |

This creates domain-specific governance.

## 8. Multi-Phase Governance Transition

Governance evolves in three deterministic phases.

### 8.1 Phase 0 — Team Governance

GridCoDe Team:

- Configures categories
- Validates Vault FSMs
- Sets fee parameters
- Maintains treasury policy
- Handles emergencies

Users participate, but cannot control parameters yet.

### 8.2 Phase 1 — Hybrid Governance

Triggered when the ecosystem reaches critical mass.

DAO co-governs:

- Treasury distribution
- Marketplace parameters

Team retains:

- Security model control
- Emergency patching
- Category creation approval

Reputation becomes critical in voting.

### 8.3 Phase 2 — Full DAO Governance

Team becomes a normal ecosystem participant.

DAO controls every configurable layer:

- All economic parameters
- Category creation/removal
- Visibility index weights
- Fee structures
- Treasury spending
- Vault configurations (non-breaking only)
- TrustBond rules

## 9. Proposal Execution Rules

All governance actions must satisfy:

### 9.1 Worker Validation

Metadata must be:

- Well-formed
- Checksum correct
- Schema-valid

### 9.2 Phantom Simulation

Proposal must simulate:

- New economic parameters
- Treasury flows
- Vault safety
- Role permissions

If simulation fails, the proposal cannot be signed.

### 9.3 Single-TX Execution

Proposal executions must create only one metadata update and one multi-recipient payout (if needed). This prevents governance actions from incurring runaway costs.

### 9.4 Immutable Vault FSM Constraint

Governance MUST NOT change:

- Vault behavior
- State transitions
- Transaction logic

Governance MAY only configure metadata-driven parameters.

## 10. Security & Anti-Sybil Rules

Governance MUST enforce:

- Reputation-weighted voting
- SubID role checks
- TrustBond requirement for high-impact proposals
- Minimum stake deposit
- Slashing of malicious governance attempts
- Lineage tracking of voters
- Mandatory receipt anchoring

GovernanceVault is a deterministic state machine with no arbitrary power.

## 11. Treasury Management

TreasuryVault is controlled by governance.

Treasury collects:

- Marketplace fees
- Slashing fees
- Challenge entry fees
- Lending liquidation margins
- Sponsor activation fees

Governance SHALL decide:

- Spending
- Rewards
- Liquidity provision
- Research grants
- Bootstrap programs

Treasury MUST maintain a minimum reserve ratio.

## 12. Governance Diagram

```
PROPOSAL_SUBMITTED
  │
  ▼
PROPOSAL_ACTIVE
  │
  ▼
VOTING  (VP = S × R × C)
  │
  └── threshold met?
        │
        ├── YES ──▶ PASSED
        │              │
        │              ▼
        │       EXECUTION_PENDING
        │              │
        │              ▼
        │       METADATA UPDATED (EXECUTED)
        │
        └── NO ──▶ FAILED
```

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:** Tier-1 Protocol Freeze v1.0
