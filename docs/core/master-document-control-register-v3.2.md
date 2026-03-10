---
title: GridCoDe Master Document Control Register (MDCR)
version: v3.2
status: Active Binding
domain: Core
layer: Documentation Governance & Authority Registry
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes:
  - master-document-control-register-v3.1.md
  - master-document-control-register-v3.0.md
  - master-document-index-v2.0.md
  - master-document-index-v2.1.md
last_reviewed: 2026-03
---

# GridCoDe Master Document Control Register (MDCR)

## 1. Purpose

MDCR v3.2 defines: document authority hierarchy, tier classification, supersession rules, freeze boundaries, cross-document dependency map, and canonical folder taxonomy.

This document supersedes MDCR v3.1 and all previous Master Index versions. MDCR is the constitutional authority for documentation governance.

Changes from v3.1: added v3.0 and v3.1-addendum whitepaper entries to Section 2.1.7 and Section 9; corrected archive filename `ri-range-definition.md` to `reputation-index-canonical-range-v1.0.md`; aligned archive runtime-legacy entries with actual repository contents.

## 2. Authority Hierarchy

### 2.1 Tier-1 — Protocol Spine (Frozen)

Tier-1 documents define immutable architectural invariants.

#### 2.1.1 Identity Layer

```
docs/identity/
  subid-role-technical-spec-v1.2.md
  reputation-stake-governance-v1.0.md
  reputation-index-canonical-range-v1.0.md
```

Defines: canonical SubID set (exactly eight roles), reputation mutation pathway, governance scaling model.

#### 2.1.2 Runtime Layer

```
docs/runtime/
  runtime-execution-architecture-v1.1.md
  contract-specification-gcspec-v1.1.md        ← Spine
  contract-specification-gcspec-v1.1-full.md   ← Extended reference
  deep-link-routing-v1.0.md
  state-domain-contract-storage-guide-v1.2.md
  ber-schema-definitions-v1.2-document-a.md
  ber-schema-definitions-v1.2-document-b.md
```

Defines: deterministic FSM doctrine, one-TX-per-mutation rule, Phantom Mode requirement, deep-link non-execution invariant, SubID enforcement, multi-recipient TX discipline, BER metadata schema definitions. Spine version governs in case of conflict.

#### 2.1.3 Store Domain (Canonical FSM Embedded)

```
docs/store/
  store-v1-protocol-spec-v1.0.md               ← Authoritative FSM + algebra
  storevault-simulation-engine-v1.0.md
  adversarial-threat-model-v1.0.md
```

`store-v1-protocol-spec-v1.0.md` is the authoritative FSM. No separate FSM matrix file exists. FSM algebra lives inside the canonical spec. The Store Listing Contract Specification is a Vault contract definition and belongs in `docs/contracts/` with its peers — not in this folder.

Defines: state set S, transition function δ, guard conditions, deterministic timeout model, value-mutation mapping, invariant set, algebraic guarantees.

#### 2.1.4 Vault Contract Specifications

```
docs/contracts/
  challenge-creation-contract-spec-v1.0.md
  grid-activation-contract-spec-v1.0.md
  loan-contract-spec-v1.0.md
  shard-rental-contract-spec-v1.0.md
  shard-sale-contract-spec-v1.0.md
  store-listing-contract-spec-v1.0.md
  trade-offer-contract-spec-v1.0.md
```

These are deterministic Vault FSM contract definitions. They are cross-domain peers, referenced by GCSPEC, and Tier-1 Active Binding. They define binding contract behavior for each Vault family. They are not domain subfolder artifacts — they are a horizontal contract layer across the system.

No Vault contract spec may be distributed into a domain folder. All Vault contract definitions belong here.

#### 2.1.5 NFT & Metadata Layer

```
docs/nft/
  entitlement-nft-standard-v1.0.md
  gridnft-standards-v1.3.md
```

Defines: grid type taxonomy, listing metadata structure, tokenization boundaries.

#### 2.1.6 Constitutional Layer

```
docs/core/
  documentation-freeze-declaration-v1.0.md
  master-document-control-register-v3.2.md
```

Defines: freeze boundary, immutable invariants, governance escalation rules, version increment requirements.

#### 2.1.7 Narrative Binding Layer

```
docs/whitepaper/
  whitepaper-v3.2-tier1-alignment-addendum.md  ← Canonical alignment addendum
  gridcode-whitepaper-v3.1-addendum.md          ← Technical enhancement addendum
  gridcode-whitepaper-v3.0.md                   ← Original narrative whitepaper
```

Whitepaper documents are narrative binding. They cannot override Tier-1 spine. They must conform to identity, runtime, and vault invariants. `whitepaper-v3.2-tier1-alignment-addendum.md` is the most recent and takes precedence on any narrative conflict.

## 3. Tier-2 — Deterministic Implementation Contracts

These enforce correct implementation of Tier-1. Tier-2 must conform to Tier-1 and cannot redefine invariants.

```
docs/engine/
  storevault-engine-invariant-contract-v1.0.md
  store-adapter-invariant-contract-v1.0.md

docs/store/
  storevault-implementation-brief-v1.0.md
  storevault-adversarial-test-plan-v1.0.md

docs/governance/
  governance-framework-v1.1.md

docs/economics/
  economics-incentive-model-v1.1.md

docs/core/
  gridcode-markdown-canonical-formatting-standard-v1.0.md
  tier-1-freeze-aligned-github-workflow-v1.0.md
```

## 4. Tier-3 — Clarification & Boundary Enforcement

```
docs/clarification/
  architecture-clarification-memo-collateralgrid-v1.0.md
```

Purpose: prevent taxonomy drift, prevent role inflation, prevent implicit GridNFT expansion. Does not introduce new invariants.

## 5. Tier-4 — Conceptual / Post-Freeze Roadmap

```
docs/roadmap/
  underwriting-grid-concept-v0.1.md
```

Status: outside freeze boundary, no effect on Store v1 or Lending v1, not referenced by Tier-1.

## 6. Archive Layer

```
docs/archive/
  duplicates-pre-freeze/
    store-protocol-v1.0.md
    reputation-stake-governance-v1.0.md
    reputation-index-canonical-range-v1.0.md
    subid-role-spec-v1.2.md
  runtime-legacy/
    master-document-control-register-v3.0.md
    gcspec-v1.1.md
    state-domain-storage-v1.2.md
```

Archived files cannot override Tier-1, cannot be referenced by active specs, and exist for historical traceability only.

## 7. Version Interaction Matrix

| If This Changes | Must Be Re-Audited |
|---|---|
| SubID Spec | Runtime, GCSPEC, Deep-Link |
| Runtime | GCSPEC, Simulation Engine |
| GCSPEC | All Vault domain specs |
| Store FSM | Simulation Engine |
| Governance Spec | RI Range |
| Freeze Declaration | Entire Tier-1 |

No Tier-1 modification may occur without cross-layer review.

## 8. Freeze Boundary Rules

Tier-1 prohibits: new SubID roles, mutation pathway alteration, programmable Vault logic, multi-TX settlement, proxy execution, routing expansion, direct RI mutation, identity inflation.

Breaking change → major version increment, governance approval, explicit supersession reference.

## 9. Canonical Repository Hierarchy

```
docs/
  core/
    master-document-control-register-v3.2.md
    documentation-freeze-declaration-v1.0.md
    gridcode-markdown-canonical-formatting-standard-v1.0.md
    tier-1-freeze-aligned-github-workflow-v1.0.md

  identity/
    subid-role-technical-spec-v1.2.md
    reputation-stake-governance-v1.0.md
    reputation-index-canonical-range-v1.0.md

  runtime/
    runtime-execution-architecture-v1.1.md
    contract-specification-gcspec-v1.1.md
    contract-specification-gcspec-v1.1-full.md
    deep-link-routing-v1.0.md
    state-domain-contract-storage-guide-v1.2.md
    ber-schema-definitions-v1.2-document-a.md
    ber-schema-definitions-v1.2-document-b.md

  contracts/
    challenge-creation-contract-spec-v1.0.md
    grid-activation-contract-spec-v1.0.md
    loan-contract-spec-v1.0.md
    shard-rental-contract-spec-v1.0.md
    shard-sale-contract-spec-v1.0.md
    store-listing-contract-spec-v1.0.md
    trade-offer-contract-spec-v1.0.md

  store/
    store-v1-protocol-spec-v1.0.md
    storevault-simulation-engine-v1.0.md
    adversarial-threat-model-v1.0.md
    storevault-implementation-brief-v1.0.md
    storevault-adversarial-test-plan-v1.0.md

  engine/
    storevault-engine-invariant-contract-v1.0.md
    store-adapter-invariant-contract-v1.0.md

  governance/
    governance-framework-v1.1.md

  economics/
    economics-incentive-model-v1.1.md

  nft/
    entitlement-nft-standard-v1.0.md
    gridnft-standards-v1.3.md

  whitepaper/
    whitepaper-v3.2-tier1-alignment-addendum.md
    gridcode-whitepaper-v3.1-addendum.md
    gridcode-whitepaper-v3.0.md

  clarification/
    architecture-clarification-memo-collateralgrid-v1.0.md

  roadmap/
    underwriting-grid-concept-v0.1.md

  archive/
    duplicates-pre-freeze/
      store-protocol-v1.0.md
      reputation-stake-governance-v1.0.md
      reputation-index-canonical-range-v1.0.md
      subid-role-spec-v1.2.md
    runtime-legacy/
      master-document-control-register-v3.0.md
      gcspec-v1.1.md
      state-domain-storage-v1.2.md
```

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Constitutional Authority
**Last Reviewed:** 2026-03
**Supersedes:** master-document-control-register-v3.1.md
**Requires:**
- `/docs/core/documentation-freeze-declaration-v1.0.md`
- `/docs/core/tier-1-freeze-aligned-github-workflow-v1.0.md`
