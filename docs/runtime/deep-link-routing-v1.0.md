---
title: GridCoDe Deep-Link Routing Specification
version: v1.0
status: Active Binding
domain: Runtime
layer: Routing & Navigation
tier: Tier-1
environment: Gridnet OS
authoritative: true
---

# GridCoDe Deep-Link Routing Specification

## 1. Purpose & Scope

### 1.1 Purpose

This document defines the canonical routing and deep-link structure for:

- Accessing Private Marketplaces
- Opening specific listings
- Redirecting from Public Market to Private Market

It standardises:

- URL format and schema
- Parameter schema
- Identity validation rules
- Security constraints

### 1.2 Scope

This specification applies to all deep-link generation and consumption within GridCoDe, including the Public Market indexer, Private Marketplace renderer, listing views, action initiations, and integration UIs.

## 2. Marketplace Identity Model

### 2.1 Unified Marketplace Identity Rule

Each Private Marketplace SHALL possess a single canonical identifier:

```markdown
marketplaceId
```

This `marketplaceId` SHALL:

- Equal the Private Marketplace `gridId`
- Equal the Grid Activation Contract identifier
- Represent the authoritative economic domain

The Public Market SHALL NOT generate, modify, or abstract this identifier.

### 2.2 Public–Private Identity Consistency Requirement

For any listing displayed in the Public Market:

- The `marketplaceId` used in the deep-link MUST match the originating Private Marketplace `gridId`
- The Public Market SHALL act only as an indexer and router
- The Public Market SHALL NOT maintain an independent marketplace identity namespace

Violation of this rule constitutes a protocol breach.

### 2.3 Security Rationale

Uniform `marketplaceId` ensures:

- Deterministic routing
- Traceable settlement linkage
- Vault consistency
- Dispute continuity
- Prevention of spoofed domain injection
- Elimination of identity translation layers

## 3. Canonical Deep-Link Structure

### 3.1 Base Structure (Marketplace)

```markdown
gridcode://store/{marketplaceId}
```

Where `marketplaceId` = Private Marketplace `gridId`. `marketplaceId` MUST be validated before rendering UI.

### 3.2 Listing-Level Structure

```markdown
gridcode://store/{marketplaceId}/listing/{listingId}
```

Where `listingId` MUST belong to `marketplaceId`. Cross-marketplace listing access SHALL be rejected.

### 3.3 Action Context Structure

```
gridcode://store/{marketplaceId}/listing/{listingId}?action={actionType}
```

Valid `actionType` values:

| actionType | Description |
|---|---|
| `purchase` | Initiate purchase flow |
| `view` | View listing details only |
| `dispute` | Initiate dispute (BUYER only) |
| `fulfill` | Mark fulfilment (SELLER only) |

Invalid `actionType` SHALL be ignored safely. No error MUST be thrown.

The following `actionType` values are explicitly forbidden in deep-links. They are system-level FSM transitions and MUST only be executed through internal Vault logic — never via external routing:

| Forbidden actionType | Reason |
|---|---|
| `resolve_seller` | Internal dispute resolution — Vault-only |
| `resolve_buyer` | Internal dispute resolution — Vault-only |
| `finalize_settlement` | Settlement gate — Vault-only |
| `override` | No override path exists at Tier-1 |

Workers MUST reject any deep-link containing a forbidden `actionType`. No partial routing is permitted.

### 3.4 Role-Specific Deep-Links

```
Grid Activation:
  gridcode://grid-activate/{grid_id}?role=SponsorID

Store Listing Creation:
  gridcode://store-listing/create/{grid_id}/{shard_id}?role=SellerID

Trade Offer:
  gridcode://trade-offer/create/{grid_id}/{shard_id}?role=TraderID

Loan Creation:
  gridcode://loan/create/{grid_id}/{shard_id}?role=BorrowerID

Challenge Join:
  gridcode://challenge/join/{challenge_id}?role=ParticipantID
```

The `role` query parameter is **informational only**. It serves as a routing hint for UI pre-loading and MUST NOT be trusted as an authoritative role claim. Workers MUST independently derive the actor's role from `actorId` matched against the SubID registry and listing context. If the derived role does not match the deep-link `role` parameter, the Worker MUST reject the TX.

Workers MUST enforce `derived_role == SubID.role` for all role-specific deep-links. The caller-supplied `role` value is never authoritative.

> **Canonical prefix:** `gridcode://`
> `gcd://v1/` is deprecated. All new integrations MUST use `gridcode://`. Workers MUST accept `gcd://v1/` as a legacy alias during transition and log a deprecation warning on each use.

## 4. Public → Private Routing Flow

### 4.1 Public Market Responsibilities

Public Market SHALL:

- Display listing metadata
- Reference `listing.marketplaceId`
- Generate deep-links using canonical `marketplaceId`
- Never execute transactions

Public Market SHALL NOT:

- Create alternative marketplace identifiers
- Remap `gridId` values
- Proxy transaction execution
- Maintain state about Private Marketplace contents

### 4.2 Private Marketplace Responsibilities

Upon receiving a deep-link, the Private Marketplace MUST:

1. Validate `marketplaceId` exists
2. Confirm `marketplaceId` matches active grid domain
3. Validate `listingId` belongs to `marketplaceId`
4. Load metadata via Worker
5. Run Phantom Mode simulation
6. Present confirmation screen to user
7. Require explicit user action before any TX

### 4.3 Routing Flow Diagram

```markdown
External URL or QR Code
  │
Deep-Link Router
  │
Schema Validation
  │  - valid gridcode:// prefix? (gcd://v1/ accepted as deprecated alias)
  │  - valid marketplaceId format?
  │  - valid listingId format?
  │
Identity / SubID Context Resolution
  │
Worker Metadata Load
  │  - BER decode
  │  - checksum validate
  │  - version check
  │
Phantom Mode Simulation
  │
Render View
  │
[User Action Required]
```

## 5. Security Constraints

### 5.1 No Auto-Execution Rule

Deep-links MUST NOT auto-execute any action. All deep-links MUST require:

1. Worker validation
2. Phantom Mode simulation
3. Explicit user confirmation

This rule is non-negotiable.

### 5.2 Permitted Deep-Link Actions

Deep-links MAY:

- Open a listing
- Open a service order
- Open a challenge
- Navigate to a grid
- Pre-fill form fields
- Pre-fill trade parameters

Deep-links MUST NOT:

- Auto-stake
- Auto-accept
- Auto-purchase
- Auto-sign

### 5.3 Cross-Marketplace Injection Prevention

```markdown
marketplaceId MUST equal listing.marketplaceId
listingId MUST belong to marketplaceId
```

If either validation fails, the deep-link MUST be rejected. No partial rendering is permitted.

### 5.4 Role Mismatch Handling

```markdown
If deep_link.role != SubID.role → Worker MUST reject TX
```

A clear error MUST be returned to the UI. No fallback execution is permitted.

### 5.5 Malformed Deep-Link Handling

Malformed deep-links MUST:

- Fail safely at the router level
- Log the failure internally (NOT exposed in the URL or UI error detail)
- Display a generic "Invalid Link" message to the user
- Return the user to the default view
- NOT expose routing internals or error specifics externally
- NOT attempt partial execution

## 6. Validation Rules Reference

| Validation | Layer | Failure Behaviour |
|---|---|---|
| `marketplaceId` format | Router | Reject, return to default view |
| `marketplaceId` exists | Private Marketplace | Reject, show error |
| `listingId` belongs to `marketplaceId` | Worker | Reject, show error |
| `deep_link.role == SubID.role` | Worker | Reject TX before simulation |
| `actionType` validity | Router | Ignore unknown values safely |
| Phantom Mode simulation | Simulation | Block signing on failure |
| User confirmation | UI | Required before any TX |

## 7. Integration Requirements

Integrators consuming GridCoDe deep-links MUST:

- Use Worker indexing for all metadata operations
- Never parse BER manually
- Never bypass Worker layer
- Execute Phantom Mode simulation before any TX
- Display simulation results to user
- Require explicit user approval before signing

Integrators MUST NOT:

- Auto-execute actions
- Submit TXs without simulation
- Sign speculative flows

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
