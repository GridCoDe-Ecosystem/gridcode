---
title: GridCoDe — SubID Role Technical Specification
version: v1.2
status: Active Binding
domain: Identity
layer: Identity & Authorization
environment: Gridnet OS
authoritative: true
---

# GridCoDe — SubID Role Technical Specification

## 1. Purpose

This document defines the official SubID role system used throughout the GridCoDe ecosystem.

A SubID is:

- A role-specific identity
- Permanently bound to a single role
- Used to authenticate and authorize all contract calls
- Validated by Workers before execution
- Tracked in the Reputation Vault

This specification establishes:

- The canonical role list
- Permissions
- Contract access rules
- Grid compatibility
- RI thresholds
- Deep-link enforcement
- Extensibility rules

## 2. Canonical SubID Role List (8 Roles Only)

GridCoDe recognizes exactly eight SubID roles:

**1. SponsorID** — Controls grid activation, grid ownership, and grid-level funding.

**2. SellerID** — Operates StoreGrid shards, manages storefront listings, inventory, delivery.

**3. TraderID** — Operates TradeGrid shards, creates trade offers, accepts offers.

**4. CreatorID** — Creates challenges, hosts brand marketplaces, manages sponsored campaigns.

**5. ProviderID** — Operates ServiceGrid workflows, delivery actions, and some challenge types.

**6. BorrowerID** — Uses CollateralGrid shards to lock collateral and request loans.

**7. LenderID** — Supplies liquidity to LendingVaults and earns yield.

**8. ParticipantID** — Lightweight role for joining challenges and submitting proofs.

These are the only roles used in all GridCoDe vaults, contracts, and markets.

## 3. Role Permission Matrix

| Permission | Sponsor | Seller | Trader | Creator | Provider | Borrower | Lender | Participant |
|---|---|---|---|---|---|---|---|---|
| Grid Activation | ✔ | | | | | | | |
| GridNFT Sale | ✔ | ✔ | ✔ | ✔ | ✔ | | | |
| Shard Rental | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| Shard Sale | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| Store Listing | | ✔ | | ✔ | | | | |
| Trade Offer | | | ✔ | | | | | |
| Challenge Create | ✔ | | | ✔ | ✔ | | | |
| Challenge Join | | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Collateral Lock | | | | | | ✔ | | |
| Loan Creation | | | | | | ✔ | | |
| Loan Repay | | | | | | ✔ | | |
| Lender Funding | | | | | | | ✔ | |
| General View | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

Every permission in this matrix is directly supported by Worker validation logic.

## 4. Role → Contract Access Mapping

**SponsorID** — Controls the grid lifecycle:

- Grid Activation Contract
- GridNFT Sale Contract
- Shard Sale Contract
- Challenge Creation (Sponsor-funded)

Denied: Trade, Store, Lending

**TraderID** — Controls P2P trading:

- Trade Offer Creation/Update/Cancel
- Trade Offer Acceptance
- Trading shard operations

Denied: Store & Lending operations

**SellerID** — Controls decentralized e-commerce:

- Listing creation / update / hide / archive
- Inventory management
- Delivery flows
- Shard rental for StoreGrid

Denied: Trade Offer Creation, Collateral/Lending

**CreatorID** — Controls brand-level challenges & content:

- Challenge Creation
- Sponsored reward programs
- Brand storefronts (optional StoreGrid shards)

Denied: Trading & Lending (unless multi-role wallet)

**ProviderID** — Controls services & delivery:

- Service fulfillment
- Challenge hosting
- Delivery confirmation

Denied: Trading & Lending

**BorrowerID** — Controls loan requests:

- Collateral lock/unlock
- Loan creation
- Loan repayment

Denied: Store & Trade

**LenderID** — Controls loan pools:

- Liquidity supply
- Interest claims
- Withdrawal

Denied: Borrowing & Trading

**ParticipantID** — Controls low-permission participation:

- Join challenges
- Submit proofs

Denied: any creation or economic operation

## 5. Grid Compatibility Rules

Workers enforce:

```
shard.grid_type == SubID.required_role_domain
```

| Grid Type | Allowed Roles |
|---|---|
| StoreGrid | SellerID, CreatorID |
| TradeGrid | TraderID |
| ChallengeGrid | CreatorID, ProviderID, ParticipantID |
| CollateralGrid | BorrowerID |
| LendingGrid | LenderID |
| ActivationGrid | SponsorID |
| ServiceGrid | ProviderID |

A mismatched SubID role results in instant rejection.

## 6. Minimum RI Thresholds per Role

Workers enforce these thresholds before Phantom Mode simulation.

These thresholds are governance-controlled parameters and may be updated via DAO policy. They are not hardcoded constants. Any update requires explicit governance action and version increment of this specification.

| Role | Minimum RI |
|---|---|
| SponsorID | 50 |
| SellerID | 40 |
| TraderID | 30 |
| CreatorID | 35 |
| ProviderID | 25 |
| BorrowerID | 30 |
| LenderID | 10 |
| ParticipantID | 0 |

## 7. Worker Validation Logic (Global)

Workers enforce:

1. Role match
2. RI threshold check
3. SubID identity signature check
4. SubID not suspended or banned
5. No conflicting pending TX
6. Metadata schema match
7. Simulation-execution parity

These rules guarantee consistency and prevent privilege escalation.

## 8. Deep-Link Role Enforcement

Workers require:

```
deep_link.role == SubID.role
```

Otherwise → reject.

Examples:

**Grid Activation**

```
gridcode://grid-activate/<grid_id>?role=SponsorID
```

**Store Listing**

```
gridcode://store-listing/create/<grid_id>/<shard_id>?role=SellerID
```

**Trade Offer**

```
gridcode://trade-offer/create/<grid_id>/<shard_id>?role=TraderID
```

**Loan Creation**

```
gridcode://loan/create/<grid_id>/<shard_id>?role=BorrowerID
```

## 9. RI Effects per Role

All RI effects listed below occur strictly through Vault FSM baseDelta emission, routed via the Reputation Engine for velocity scaling. No role-based direct RI mutation exists. SubID roles do not independently modify RI — they participate in Vault FSMs that emit baseDeltas.

- **SponsorID** — +RI for active epochs; −RI for abandoned grids
- **SellerID** — +RI for fulfilment; −RI for disputes
- **TraderID** — +RI for successful trades; −RI for bad cancellations
- **CreatorID** — +RI for effective challenges; −RI for failed/abandoned challenges
- **ProviderID** — +RI for successful services; −RI for lateness/failure
- **BorrowerID** — +RI for full repayment; −RI for defaults
- **LenderID** — +RI for consistent liquidity supply
- **ParticipantID** — +RI for proof submissions

## 10. Role Expandability

GridCoDe MAY support adding new SubID roles, subject to the following constraints:

- Requires explicit governance approval
- Requires a version increment of this specification
- Requires full Vault FSM compatibility review
- Requires RI threshold definition
- Requires deep-link mapping update
- Is NOT automatic or implied by registry update alone

New roles are not plug-and-play additions. Each introduces identity surface area that must be reviewed across the full Tier-1 spine before activation.

New roles can be added by updating:

- RoleRegistry
- role_permission_map
- Deep-link mapping table
- UI role selector

Adding new roles does not invalidate existing contracts, but may require governance parameter updates — including RI threshold mapping, Vault FSM interaction review, and economic emission assessment.

## 11. Compliance Summary

This SubID role set is fully aligned with:

- GridCoDe Whitepaper v3.0
- Technical Addendum v3.1
- Runtime Execution Architecture v1.1
- GridNFT Standards v1.3
- Identity & Reputation v1.2
- Activation/GCU Framework
- Marketplace (Store, Trade, Challenge)
- All Contract Specifications

Obsolete roles removed: BuilderID, GeneralID.

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** v1.1
**Requires:**
- `/docs/identity/reputation-stake-governance-v1.0.md`
- `/docs/identity/ri-canonical-range-definition-v1.0.md`
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
