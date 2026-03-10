---
title: GridCoDe Underwriting Grid — Concept Specification
version: v0.1
status: Conceptual Draft
domain: Roadmap
layer: Post-Freeze Conceptual Architecture
tier: Tier-4
environment: Gridnet OS
authoritative: false
supersedes: None
requires:
  - /docs/nft/gridnft-standards-v1.3.md
  - /docs/contracts/loan-contract-spec-v1.0.md
  - /docs/identity/reputation-stake-governance-v1.0.md
last_reviewed: 2026-02
---

# GridCoDe Underwriting Grid — Concept Specification

**Status:** Conceptual Roadmap Layer
**Scope:** Post-Store v1 / Post-Lending v1
**Impact on v1:** None
**Freeze Boundary:** Outside current freeze

## 0. Document Intent

This document defines the conceptual architecture for a future GridNFT type enabling composable, monetizable underwriting liquidity across multiple GridCoDe domains.

This specification does NOT modify:

- Store v1
- Lending v1
- Current GridNFT taxonomy
- Reputation Engine v1
- Stake Governance v1

It introduces a new economic layer intended for future expansion.

## 1. Purpose

### 1.1 Problem

In Lending v1, collateral is self-provided, grid-scoped, non-transferable, non-composable, and locked per exposure. This limits capital efficiency, liquidity reuse, risk specialization, and yield markets for risk providers.

### 1.2 Objective

Introduce a structured underwriting market where:

- Participants stake capital
- Borrowers bind to underwriting positions
- Risk providers earn yield
- Defaults produce deterministic slashing
- Reputation couples to underwriting performance
- Exposure is bounded and auditable

This layer upgrades GridCoDe from isolated vault loops to composable risk infrastructure.

## 2. Terminology

**Underwriter** — participant providing risk capital.

**Borrower** — participant binding to underwriting liquidity.

**Exposure** — amount of underwriting capital committed to a borrower.

**Tranche** — shard-level underwriting capacity unit.

**Underwriting Grid** — a GridNFT representing a discoverable underwriting marketplace.

**Underwriting Vault** — deterministic engine tracking exposure and slashing.

## 3. New GridNFT Type

### 3.1 Proposed Type

```markdown
UNDERWRITING_GRID
```

This GridNFT represents a structured market for underwriting liquidity. It does not represent collateral itself. Collateral remains stake-locked in the Vault. The Grid is the discovery surface.

## 4. Architectural Model

### 4.1 Grid Layer

Each UnderwritingGrid has shards. Each shard represents a tranche. Each tranche carries:

- `maxExposure`
- `lockedStake`
- `exposureRatio`
- `yieldRate`
- `riskTier`

Underwriters claim shards. Borrowers bind exposure to shards.

### 4.2 Vault Layer

UnderwritingVault responsibilities:

- Track stake locked
- Track exposure assigned
- Enforce exposure caps
- Apply deterministic slashing
- Emit base reputation deltas
- Track tranche utilization
- Enforce dual-gate eligibility

The Vault MUST remain deterministic, stateless outside aggregate, and independent from UI and network calls.

### 4.3 Cross-Vault Communication

LendingVault communicates to UnderwritingVault as follows:

- When a borrower loan is issued: exposure assigned to tranche
- When a borrower defaults: slashing event propagated
- When a borrower repays: exposure released

Cross-vault communication MUST be deterministic and atomic.

## 5. Shard Model

Each shard represents one underwriting tranche. Shard fields:

- `trancheId`
- `underwriterId`
- `stakeLocked`
- `exposureUsed`
- `maxExposure`
- `yieldAccrued`
- `slashingHistory`
- `version`

Invariant:

```markdown
exposureUsed ≤ maxExposure
```

## 6. Economic Model

### 6.1 Yield

Underwriters earn borrower underwriting fees, a possible LendingVault share, and governance-defined incentive streams. Yield MUST be proportional to exposure, bounded by deterministic rules, and use the multi-recipient TX model.

### 6.2 Slashing

| Fault Category | Stake Impact | RI Impact |
|---|---|---|
| Minor fault | Partial slash | Small penalty |
| Major fault | Significant slash | Moderate penalty |
| Malicious or systemic fault | Maximum slash | High penalty |

Negative deltas are never friction-reduced. Stake loss MUST couple to RI loss.

## 7. Reputation Coupling

Underwriting performance influences global RI.

Positive outcomes: successful loan cycles, no slashing events.

Negative outcomes: exposure default, repeated slashing.

Velocity scaling remains governed by Reputation Engine v1. See `/docs/identity/reputation-stake-governance-v1.0.md`.

## 8. Risk Isolation Rules

Each UnderwritingGrid is isolated. Default in Grid A does not contaminate Grid B. Stake is grid-scoped. No cross-grid contagion is permitted.

## 9. Determinism Guarantees

UnderwritingVault MUST satisfy:

- No randomness
- No implicit time calls — timestamp injected
- Pure state transitions
- Immutable aggregates
- Atomic persistence required

## 10. Security Considerations

The UnderwritingVault design prevents:

- Infinite leverage loops
- Double exposure allocation
- Exposure overcommitment
- Slashing evasion
- Identity spoofing
- Role spoofing
- Grid hopping to escape penalties

Requirements: version locking, atomic exposure checks, deterministic slashing rules.

## 11. Non-Goals

Underwriting v1 SHALL NOT:

- Introduce dynamic pricing or auctions
- Allow cross-chain capital flows
- Introduce insurance derivatives
- Support recursive rehypothecation
- Override Reputation Engine scaling
- Alter Store or Lending v1 semantics

## 12. Implementation Roadmap Phase

This layer is recommended only after:

- Store v1 stabilized
- Lending v1 validated
- Reputation engine proven
- Cross-vault atomic execution tested

Suggested version: GridCoDe v2 Risk Infrastructure Layer.

## 13. Strategic Impact

This transforms GridCoDe into a structured underwriting marketplace, capital efficiency engine, modular liquidity system, and risk-pricing discovery environment. It is a major architectural evolution — not a Store v1 or Lending v1 concern.

---

**Canonical Status:** Conceptual Draft
**Document Tier:** Tier-4 — Conceptual / Post-Freeze Roadmap
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/nft/gridnft-standards-v1.3.md`
- `/docs/contracts/loan-contract-spec-v1.0.md`
- `/docs/identity/reputation-stake-governance-v1.0.md`
