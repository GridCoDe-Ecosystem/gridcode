---
title: GridCoDe Entitlement NFT & Listing Metadata Standard
version: v1.0
status: Active Binding
domain: NFT
layer: Settlement-Bound Entitlement Model
environment: Gridnet OS
authoritative: true
---

# GridCoDe Entitlement NFT & Listing Metadata Standard

## 1. Purpose & Design Principles

### 1.1 Purpose

This document defines the canonical metadata schema and minting rules for Entitlement NFTs used within GridCoDe Store v1.

It standardises:

- NFT structure and mandatory fields
- Listing metadata schema
- Delivery proof structure
- Ownership semantics
- Transfer behaviour
- Mint timing rules

This specification is normative for Store v1 implementation and is reusable across future Store versions and application types.

### 1.2 Design Principles

Entitlement NFTs SHALL be:

1. Deterministic
2. Immutable after mint
3. Settlement-bound
4. Reputation-isolated
5. Hash-verifiable
6. Compatible with GRIDNFT Standards v1.3

### 1.3 Relationship to Store Protocol

Entitlement NFTs are post-settlement artefacts. They depend on the StoreVault FSM reaching `settlementFinalized = true`. They are NOT part of the core FSM. See `/docs/store/protocol-v1.0.md` for FSM definition.

## 2. Entitlement NFT Model

### 2.1 Definition

An Entitlement NFT represents a verifiable digital ownership or access right resulting from a successfully finalised Store transaction.

It does NOT represent:

- Governance rights
- Staking rights
- Financial derivatives
- Reputation score

### 2.2 Minting Rule

An Entitlement NFT SHALL ONLY be minted when all three conditions are satisfied:

```markdown
listing.state                                == FULFILLED
settlementFinalized                          == true
listing.disputeRecord == null
  OR listing.disputeRecord.resolved          == true
```

Minting prior to `settlementFinalized = true` is strictly prohibited.

### 2.3 Core NFT Fields (Mandatory)

```typescript
interface EntitlementNFT {
  tokenId:          string    // deterministically derived
  listingId:        string
  sellerId:         string
  buyerId:          string
  mintTimestamp:    number
  entitlementType:  EntitlementType
  metadataHash:     string    // SHA-256 of canonical JSON
  version:          number    // schema version
}
```

### 2.4 Deterministic tokenId Rule

`tokenId` MUST be derived deterministically from:

```markdown
tokenId = hash(listingId + buyerId + settlementTimestamp)
```

This prevents duplicate minting and replay attacks. The NFT contract MUST reject any mint attempt producing an existing `tokenId`.

## 3. entitlementType Enumeration

```typescript
enum EntitlementType {
  DOWNLOAD     = 'DOWNLOAD',
  ACCESS       = 'ACCESS',
  LICENSE      = 'LICENSE',
  MEMBERSHIP   = 'MEMBERSHIP',
  SUBSCRIPTION = 'SUBSCRIPTION',
  CUSTOM       = 'CUSTOM',
}
```

`CUSTOM` type SHALL require additional metadata fields to be defined. A listing with `entitlementType = CUSTOM` MUST include an `additionalAttributes` object in its metadata.

## 4. Listing Metadata Schema

All Store listings SHALL include structured metadata in canonical JSON format.

### 4.1 Canonical JSON Requirement

Metadata MUST:

- Use deterministic key ordering
- Use UTF-8 encoding
- Be serialised before hashing
- Produce a consistent `metadataHash`

### 4.2 Required Fields

```typescript
interface ListingMetadata {
  listingId:        string
  title:            string
  description:      string
  price:            number
  assetType:        string
  sellerId:         string
  createdTimestamp: number
  entitlementType:  EntitlementType
  contentURI:       string
  schemaVersion:    number
}
```

`metadataHash` is derived by serialising this object to canonical JSON and applying SHA-256. It MUST NOT appear as a field within `ListingMetadata` itself — doing so would create a recursive hashing dependency. The hash lives only in `EntitlementNFT`.

### 4.3 Optional Fields

```typescript
interface ListingMetadataOptional {
  previewURI?:           string
  category?:             string
  tags?:                 string[]
  expirationTimestamp?:  number
  licenseTermsURI?:      string
  royaltyPercentage?:    number
  transferable?:         boolean
  maxSupply?:            number
  additionalAttributes?: object
}
```

Optional fields MUST NOT break canonical hash determinism.

## 5. Metadata Hash Integrity

### 5.1 Hash Algorithm

`metadataHash` MUST use SHA-256 or stronger.

### 5.2 Mutation Rule

If listing metadata changes:

```markdown
A new metadataHash MUST be generated
A new listing version MUST be created
Previously minted NFTs MUST remain unchanged
```

Retroactive mutation is prohibited. Past NFTs represent frozen entitlements.

## 6. Delivery Proof Model

### 6.1 Requirement

The FULFILL action MUST include `deliveryProofHash`. See `/docs/store/fsm-matrix-v1.0.md`.

### 6.2 Delivery Mechanisms

Delivery MAY occur via:

- Gated `contentURI` unlock
- Encrypted file access
- API-based entitlement verification
- On-chain access validation

Delivery implementation is application-layer specific.

### 6.3 Proof Structure

The seller MAY attach:

```typescript
interface DeliveryProof {
  deliveryProofHash:    string
  fulfillmentTimestamp: number
  proofMetadata?:       object  // serialisable and deterministic
}
```

### 6.4 Proof and Dispute Interaction

During a dispute, evidence MAY reference `deliveryProofHash`. Proof validation SHALL remain deterministic. NFT minting SHALL NOT occur until dispute is resolved.

## 7. Ownership & Transfer Rules

### 7.1 Ownership Definition

NFT ownership SHALL be determined by the wallet holding `tokenId`.

### 7.2 Transferability

```markdown
If transferable = true:
  NFT MAY be transferred
  Reputation SHALL remain wallet-bound

If transferable = false:
  NFT SHALL be non-transferable
  Adapter SHALL enforce transfer rejection
```

### 7.3 Reputation Isolation

Transfer of an Entitlement NFT SHALL NOT:

- Transfer seller reputation
- Transfer buyer reputation
- Transfer transaction performance history

Reputation remains identity-bound. Entitlement ≠ trust score.

## 8. Subscription & Expiration

### 8.1 Expiration Rule

If `expirationTimestamp` exists:

- Entitlement validity SHALL expire at that timestamp
- NFT MAY remain as a historical record

Expiration SHALL NOT retroactively alter settlement.

### 8.2 Renewal Model

Renewal MAY:

- Extend `expirationTimestamp`
- Mint a new NFT
- Update metadata via a new listing version

Renewal SHALL NOT mutate the existing NFT state.

## 9. Royalty Metadata Extension

If `royaltyPercentage` is defined:

- Secondary transfers MAY trigger royalty logic
- Royalty enforcement SHALL be external to Store Core

Store v1 does NOT enforce secondary royalties. Royalty logic is application-layer.

## 10. Compliance with GRIDNFT Standards

Entitlement NFTs SHALL:

- Conform to GRIDNFT structural standards (v1.3)
- Be indexable by Gridnet OS
- Preserve deterministic minting
- Avoid side-channel state mutation

## 11. Security Invariants

1. NFT mint SHALL only occur after `settlementFinalized = true`.
2. `metadataHash` MUST match the canonical JSON representation of listing metadata.
3. Duplicate `tokenId` minting MUST be impossible.
4. NFT metadata MUST be immutable post-mint.
5. Transfer rules MUST be deterministic.
6. Entitlement NFTs SHALL only be minted for listings in state `FULFILLED`. Minting MUST NOT occur for listings in state `CANCELLED` or any other non-terminal state.
7. `deliveryProofHash` MUST exist before mint trigger is valid.

## 12. Future Extensions

The following are out of scope for v1.0 and reserved for future versions:

- Dynamic metadata updates via versioning
- On-chain encrypted storage
- Cross-market entitlement validation
- Reputation-weighted access tiers
- DAO-managed royalty logic

---

**Canonical Status:** Active Binding
**Document Tier:** Tier 1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/store/protocol-v1.0.md`
- `/docs/store/canonical-spec-v1.0.md`
