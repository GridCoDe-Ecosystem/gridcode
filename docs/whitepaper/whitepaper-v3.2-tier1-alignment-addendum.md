---
title: GridCoDe Whitepaper v3.2 — Tier-1 Alignment Addendum
version: v3.2
status: Binding Clarification
domain: Whitepaper
layer: Narrative Alignment
tier: Tier-1 (Interpretive)
environment: Gridnet OS
authoritative: true
supersedes:
  - v3.0 (Interpretive Layer Only)
  - v3.1 (Interpretive Layer Only)
requires:
  - /docs/identity/subid-role-technical-spec-v1.2.md
  - /docs/runtime/runtime-execution-architecture-v1.1.md
  - /docs/runtime/contract-specification-gcspec-v1.1.md
  - /docs/runtime/deep-link-routing-v1.0.md
  - /docs/identity/reputation-stake-governance-v1.0.md
last_reviewed: 2026-02
---

# GridCoDe Whitepaper v3.2 — Tier-1 Alignment Addendum

> This document does not define executable protocol behavior. It binds interpretive language to the frozen Tier-1 spine.

## 1. Purpose

### 1.1 Binding Statement

This addendum formally aligns Whitepaper v3.0 and Technical Addendum v3.1 with the Tier-1 Protocol Spine as declared in the Tier-1 Protocol Freeze Declaration v1.0.

Whitepaper v3.0 and v3.1 remain architecturally valid. This document clarifies and binds interpretation to the frozen invariants. Tier-1 spine governs protocol truth.

## 2. Deterministic Vault Clarification

### 2.1 Clarification

Vaults described in v3.0/v3.1 are static deterministic finite state machines (FSMs).

They are:

- Not programmable contracts
- Not Turing-complete
- Not on-chain script engines
- Not consensus-layer logic

Vault transitions:

- Are pre-defined
- Are deterministic
- Must pass Phantom Mode simulation
- Map to exactly one value-mutating transaction
- Require explicit user confirmation

No Vault may execute arbitrary logic. This interpretation is binding.

## 3. Reputation Mutation Path Clarification

### 3.1 Canonical Path

All reputation changes originate exclusively from:

```
Vault FSM → baseDelta → Reputation Engine scaling
```

There is:

- No direct role-based modification
- No UI-based adjustment
- No administrative override
- No TrustBond direct mutation

All reputation effects are deterministic outputs of Vault state transitions. This pathway is singular and immutable under Tier-1.

## 4. Identity Model Clarification

### 4.1 Canonical SubID Set

Whitepaper references to roles, builders, participants, sponsors, and similar contextual actors are governed strictly by SubID Role Technical Specification v1.2.

GridCoDe recognizes exactly eight canonical SubID roles. Contextual actors such as Requester, Insured, and BondOwner are not identity classes.

Role expansion requires:

- Governance approval
- Version increment
- Cross-document compatibility review

Whitepaper language does not expand the canonical identity set.

## 5. Public Market Execution Boundary

### 5.1 Scope Constraint

Public Market functions strictly as: indexer, discovery layer, and routing layer.

Public Market:

- Does not execute transactions
- Does not proxy settlement
- Does not mutate state
- Does not abstract marketplace identity

All execution occurs within the originating Private Marketplace domain.

## 6. Deep-Link Execution Rule

### 6.1 Non-Negotiable Invariant

Deep-links:

- Cannot dispatch transactions
- Cannot auto-execute
- Cannot bypass Worker validation
- Cannot bypass Phantom Mode

All deep-link actions require: Worker validation, SubID permission check, Phantom Mode simulation, and explicit user signing. This is a non-negotiable invariant.

## 7. Concurrency & Nonce Discipline

### 7.1 Serialisation Rule

All execution is serialized per SubID. No concurrent transaction dispatch per identity is permitted. Wallet OS enforces nonce progression. UI must prevent duplicate pending actions.

## 8. Governance Supremacy Clause

### 8.1 Precedence Rule

If any narrative statement in Whitepaper v3.0 or v3.1 conflicts with a Tier-1 specification, the Tier-1 specification SHALL prevail.

Whitepaper language SHALL be interpreted in accordance with:

- SubID Role Technical Specification v1.2
- Runtime Execution Architecture v1.1
- GCSPEC v1.1
- Deep-Link Routing Specification v1.0
- Reputation & Stake Governance v1.0

No whitepaper statement may be construed to override, extend, or supersede a frozen Tier-1 spine document.

## 9. Architectural Maturity Statement

### 9.1 Protocol Status

With Tier-1 Freeze declared, GridCoDe has transitioned from conceptual architecture to a deterministic protocol framework.

Whitepaper v3.2 does not introduce new mechanics. It binds interpretation to the frozen spine.

## 10. Versioning Constraints

### 10.1 Permitted Future Changes

Whitepaper versions following v3.2 may: improve clarity, add diagrams, and expand explanation.

### 10.2 Prohibited Future Changes

Whitepaper versions following v3.2 MUST NOT:

- Introduce new identity classes
- Modify mutation pathways
- Alter the deterministic execution model
- Expand deep-link authority
- Modify Vault state logic

Such changes require a Tier-1 version increment, governance approval, and explicit supersession reference.

---

**Canonical Status:** Binding Clarification
**Document Tier:** Tier-1 — Interpretive Layer
**Last Reviewed:** 2026-02
**Supersedes:** Whitepaper v3.0 & v3.1 (Interpretive Layer Only)
**Requires:** Tier-1 Protocol Spine Documents
