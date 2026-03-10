---
title: GridCoDe Architecture Clarification Memo — CollateralGridNFT
version: v1.0
status: Active Binding
domain: Core
layer: Terminology Freeze & Taxonomy Boundary Enforcement
tier: Tier-3
environment: Gridnet OS
authoritative: true
document_ref: GRIDCODE-CLARIFICATION-001
applies_to:
  - /docs/nft/gridnft-standards-v1.3.md
  - All GridCoDe Contract Specifications
supersedes: None
last_reviewed: 2026-02
---

# GridCoDe Architecture Clarification Memo — CollateralGridNFT

## 1. Purpose

This memo formally clarifies that CollateralGridNFT does not exist as a GridNFT type within GridCoDe v1. It establishes the correct architectural framing to prevent terminology drift and preserve documentation freeze discipline.

## 2. The Incorrect Framing

The following claim has been observed and is hereby corrected:

> "GridCoDe has a CollateralGridNFT — it is an operationally critical structure within the LendingGrid family."

This statement contains a category error. It conflates a shard usage pattern inside LendingGrid with a standalone GridNFT type. Those are not equivalent.

## 3. GridNFT Taxonomy Is Explicit and Closed

The authoritative source is `/docs/nft/gridnft-standards-v1.3.md`. The canonical GridNFT type table defines the following `grid_type` classes:

| Grid Type | Status |
|---|---|
| StoreGrid (incl. DisplayGrid, InventoryGrid) | Defined |
| ServiceGrid | Defined |
| ChallengeGrid | Defined |
| TradeGrid | Defined |
| LendingGrid | Defined |
| InsuranceGrid | Defined |
| ActivationGrid | Defined |
| LiquidityGrid | Defined |
| EducationGrid | Defined |
| GovernanceGrid | Defined |
| CustomGrid | Defined |
| CollateralGridNFT | NOT DEFINED — does not exist as a GridNFT type |

If a structure is not listed in the GridNFT Standards taxonomy, it is not a GridNFT class.

## 4. What Actually Exists

The Loan Contract Specification (v1.0) references "CollateralGrid shard" and "CollateralVault" as operational terms. These describe:

- A shard position within LendingGrid used by BorrowerID to lock collateral
- A vault-bound execution surface (CollateralVault) attached to LendingGrid
- An internal staking mechanism — not a public market surface

These are internal mechanisms. They do not constitute a standalone GridNFT type.

## 5. The Classification Boundary

To qualify as a GridNFT type, a structure MUST satisfy all of the following:

| Requirement | CollateralGrid Shard |
|---|---|
| Independent `grid_type` defined in GridNFT Standards | No |
| Own activation contract and epoch semantics | No |
| Sponsor role with independent ownership | No |
| Appears in Public Market as its own grid | No |
| Independently discoverable from LendingGrid | No |
| Own shard claimability outside LendingGrid | No |
| Can exist without LendingGrid | No |

CollateralGrid shard satisfies none of the required criteria.

## 6. Why "Operationally Critical" Does Not Grant Classification

Many operationally critical structures exist in GridCoDe that are not GridNFT types: escrow inside StoreVault, receipt arrays, dispute records, stake locks, and reputation buffers.

Importance does not grant GridNFT classification. Vaults are execution engines. Grids are market surfaces. They are distinct layers.

## 7. The Risk of Informal Expansion

If collateral shard usage is informally referred to as CollateralGridNFT, the following risks emerge:

- Silent expansion of the GridNFT taxonomy outside the freeze boundary
- Confusion between grid surface and vault primitive
- Implied standalone market identity that does not exist
- Suggested composability paths that are not yet designed or approved
- Erosion of documentation freeze discipline

## 8. Correct Terminology

GridCoDe uses collateralized shards within the LendingGrid framework. These shards feed into CollateralVault logic. They do not constitute a standalone GridNFT type.

## 9. Future Path — If Collateral Becomes a Grid Type

If GridCoDe ever introduces discoverable underwriting, collateral marketplaces, or public exposure tranches, a new GridNFT type would be formally defined — for example, UnderwritingGridNFT. This would require:

- Explicit entry in GridNFT Standards taxonomy
- Defined `grid_type` identifier
- Activation semantics and Sponsor role
- Approved shard topology and vault mapping
- DAO governance approval and documentation version increment

That would be a deliberate expansion — not a retroactive reinterpretation of existing LendingGrid mechanics.

## 10. Final Verdict

GridCoDe v1 does not define a CollateralGridNFT.

CollateralGrid references in the Loan Contract Specification describe an internal shard usage pattern and vault execution surface within LendingGrid. This structure is not listed in GridNFT Standards v1.3, does not carry an independent `grid_type`, and does not constitute a GridNFT class.

All documentation and communication MUST reflect this boundary.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-3 — Clarification & Boundary Enforcement
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/nft/gridnft-standards-v1.3.md`
- `/docs/contracts/loan-contract-spec-v1.0.md`
