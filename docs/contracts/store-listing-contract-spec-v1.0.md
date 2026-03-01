---
title: GridCoDe — Store Listing Contract Specification
version: v1.0
status: Active Binding
domain: Contracts
layer: Contract Specification — StoreGrid
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Store Listing Contract Specification

## 1. Purpose

The Store Listing Contract allows a StoreGrid tenant (SellerID SubID) to:

- Create new product listings
- Update product metadata
- Remove listings
- Set pricing and stock levels
- Publish listings into the Public Market via the PublicMarket indexer
- Maintain trustless e-commerce behavior (no centralized storage or control)

This contract is the backbone of decentralized commerce inside GridCoDe.

## 2. Preconditions

Before a Store listing can be created, Workers MUST enforce:

**Grid & Shard**

- Grid MUST be `ACTIVE`
- Shard MUST be `CLAIMED`
- Tenant SubID MUST equal `shard-meta.tenant_subid`
- Shard MUST belong to a StoreGrid (`grid_type = store`)

**Tenant**

- SubID role MUST be `SellerID`
- RI MUST be ≥ `minimum_seller_ri`
- Tenant MUST NOT be in a dispute state
- Tenant MUST NOT exceed `max_listings_per_shard`

**Listing Request**

- Metadata fields MUST conform to `store-listing-meta.ber` schema
- `price` ≥ `min_job_price`
- File hashes (images) MUST be valid
- Metadata size MUST be ≤ `max_metadata_size`

If any requirement fails, Workers MUST block before Phantom Mode.

## 3. Metadata Structure (BER)

Each product listing uses a dedicated metadata file: `store-listing-meta.ber`.

### 3.1 Formal Schema

```
StoreListingMeta:
  listing_id:     u64
  grid_id:        u64
  shard_id:       u64
  seller_subid:   u64
  title:          string
  description:    string
  price:          u64
  stock:          u32
  image_hashes:   [hash32]
  created_at:     u64
  last_updated:   u64
  status:         u8   # 0=Active, 1=Hidden, 2=Archived
```

### 3.2 Allowed Mutations

| Field | Mutation |
|---|---|
| `title` | Update |
| `description` | Update |
| `price` | Update |
| `stock` | Update |
| `image_hashes` | Update |
| `status` | Update (0, 1, 2) |
| `last_updated` | Update |

### 3.3 Forbidden Mutations

The following fields MUST remain immutable:

- `listing_id`
- `grid_id`
- `shard_id`
- `seller_subid`
- `created_at`
- Metadata schema version

Workers MUST enforce strict immutability on all forbidden fields.

## 4. Contract FSM (StoreListingVault)

```
INIT → ACTIVE ↔ UPDATED → ARCHIVED
                  │
                  ▼
               HIDING
                  │
                  └──▶ ACTIVE
```

| State | Meaning |
|---|---|
| `INIT` | Listing created but not yet visible |
| `ACTIVE` | Listing is live in Public Market |
| `UPDATED` | Metadata changed; UI re-index required |
| `HIDING` | Listing temporarily hidden |
| `ARCHIVED` | Permanent removal |

Workers MUST trigger Public Market re-index whenever state transitions to `ACTIVE` or `UPDATED`.

The FSM state MUST mirror the `metadata.status` field at all times. A transition that updates FSM state MUST atomically update `status` to the corresponding value. Any divergence between FSM state and `metadata.status` is a protocol violation.

## 5. Phantom Mode Simulation

Simulation MUST:

- Validate metadata
- Check role and shard claim
- Compute Public Market ranking preview (non-binding)
- Compute fees (execution fee only; no marketplace fee)
- Generate `metadata_diff_hash`
- Confirm that listing will not break UI limits

Simulation output:

```
simulation_result:
  listing_id
  state_post
  metadata_diff_hash
  preview_visibility_score
  timestamp
```

Workers MUST enforce execution parity against simulation output.

## 6. Vault Execution

Store listing is handled by StoreListingVault.

**Create Listing:**

1. Validate SubID permissions
2. Write new `store-listing-meta.ber`
3. Emit `ReceiptPreconfirm`
4. Commit metadata
5. Emit `ReceiptConfirm`

**Update Listing:**

1. Validate editable fields
2. Write updated fields
3. Emit receipts
4. Trigger Public Market re-index

**Hide Listing:**

- Set `status = 1` (Hidden)

**Archive Listing:**

- Set `status = 2` (Archived)
- Listing no longer appears in Public Market

There are no value transfers. All operations are metadata updates (non-custodial).

## 7. Fee Model

Store listing actions incur:

- No marketplace fees
- Gridnet OS execution fee only

Marketplace fees (4%) apply only when a purchase occurs. This is handled by StoreVault, not StoreListingVault, and follows the Marketplace Fee Table.

## 8. Integration With Public Market

Each valid listing is automatically indexed into:

```
public-market-index/store/<grid_id>/<listing_id>.json
```

Workers send indexing hints:

```
INDEX_HINT:
  grid_id
  listing_id
  status
  price
  seller_ri
  last_updated
```

Public Market uses RI, fulfilment rates, disputes, rating score, and recent activity for ranking. The contract itself is not responsible for ranking logic.

## 9. Worker Validation Rules

Workers MUST verify:

**Metadata Validity**

- BER structure and checksum
- Valid string lengths
- `image_hash` array size within limits

**Seller Identity**

- SubID is correct shard tenant
- Role equals `SellerID`

**Shard & Grid Validity**

- `shard-meta.state = CLAIMED`
- Grid is `ACTIVE`

**Economic Validity**

- `price ≥ min_job_price`
- No risk of fee inversion

**Safety**

- Metadata MUST NOT exceed `max_metadata_size` (default 10KB, configurable)
- Listing count MUST NOT exceed `max_listings_per_shard`

If any check fails, Workers MUST reject.

## 10. Deep-Link Routing

Deep-links use the canonical `gridcode://` scheme.

**Listing creation:**

```
gridcode://store-listing/create/<grid_id>/<shard_id>?role=SellerID
```

**Listing edit:**

```
gridcode://store-listing/edit/<listing_id>?role=SellerID
```

Deep-link loads:

- `grid-meta`
- `shard-meta`
- `listing-meta`
- Active epoch time
- Metadata limits

UI branches based on current state.

## 11. Security Model

Protective mechanisms:

- Metadata immutability rules enforced by Workers
- `seller_subid` binding enforced at every transition
- Role validation — SellerID only
- Worker schema and BER verification
- Listing count limit enforcement
- Replay prevention via nonce and preconfirm hash
- Dispute status check before any write

Prevents: listing hijacking, impersonation attacks, metadata corruption, spam listing attacks, rent extraction through fake listings.

## 12. Receipt Structure

**receipt-preconfirm.ber fields:**

```
listing_id
grid_id
seller_subid
metadata_diff_hash
timestamp
```

**receipt-confirm.ber fields:**

```
listing_id
new_status
block_height
timestamp
```

Receipts support audit, dispute resolution, and market re-indexing.

## 13. Compliance Check

This contract is fully compliant with:

- Whitepaper v3.0 (StoreGrid logic)
- Technical Addendum v3.1 (TX rules, Worker-first validation)
- GCSPEC v1.1 (metadata boundaries and FSM)
- Runtime Architecture v1.1 (simulation parity)
- GridNFT Standards v1.3 (StoreGrid definition)
- Identity & Reputation v1.2 (SellerID behavior)
- Marketplace Fee Table v1.0
- Activation/GCU Framework (grid activation constraints)
- Landlord–Tenant Yield Model (activity-based weighting)

## 14. Display Grid & Inventory Grid Integration

GridCoDe StoreGrids operate using a three-layer NFT architecture:

1. StoreGridNFT (parent grid)
2. DisplayGridNFT (front-facing storefront grid)
3. InventoryGridNFT (fulfillment and stock grid)

All three are full GridNFTs that follow the standard grid rules defined in the GridNFT Standards.

### 14.1 DisplayGridNFT — Storefront Visibility Layer

The Display Grid is the NFT-backed grid that determines which products are visible, how listings are positioned, how they are indexed by the Public Market, and how sellers organize their storefront.

Display Grid responsibilities:

- Holds storefront slots (shards); each slot equals one visible product listing
- Updated when listings are created, edited, hidden, or archived
- Used by Public Market indexer to render store pages
- Enforces listing caps per tenant (`max_listings_per_shard`)

Behavior:

- Creating a listing claims a Display Grid shard
- Updating the listing updates the Display Grid shard metadata
- Hiding or archiving removes the slot from visibility
- Public Market ranking is derived from Display Grid metadata (RI, sales history, fulfilment score)

DisplayGridNFT behaves exactly like a normal GridNFT: it has its own GridID, metadata, activation requirements, and shards.

### 14.2 InventoryGridNFT — Stock & Fulfillment Layer

The Inventory Grid is the NFT-backed structure that maintains product stock, fulfillment state, and delivery guarantees. Every StoreGrid listing MUST link to an Inventory Grid slot.

Inventory Grid responsibilities:

- Holds product inventory/stock cells; each cell equals one product's fulfillment backend
- Maintains: `stock_count`, reserved stock (pending orders), fulfilment stake (optional), delivery evidence proof hashes, refund/return history, dispute anchors
- Key input to seller RI and fulfilment score

Behavior:

- Listing creation allocates an Inventory Grid shard to that product
- Stock decreases when purchases occur
- Delivery evidence updates Inventory Grid metadata
- Workers MUST verify stock before purchase
- Refunds or disputes modify Inventory Grid fulfillment history and Reputation Vault scores

### 14.3 Listing Contract Interaction With Both Grids

**Listing Creation** — Tenant claims:

- Display Grid shard → visual slot
- Inventory Grid shard → stock/fulfillment slot

StoreListingVault writes:

- `store-listing-meta.ber`
- `display-shard-meta.ber` (visibility)
- `inventory-shard-meta.ber` (stock)

**Listing Updates:**

- Price or description updates → update `listing-meta` only
- Stock updates → update `inventory-meta` only
- Image or title updates → update `listing-meta` only
- Status updates → update `display-meta` (hide/archive)

**Listing Removal:**

- Archiving sets DisplayGrid slot to `INACTIVE`
- InventoryGrid shard is also set to `INACTIVE` for that listing
- Historical metadata persists for audit and reputation

### 14.4 Worker Validation Implications

Workers MUST validate:

**Before listing creation:**

- DisplayGrid shard is `VACANT`
- InventoryGrid shard is `VACANT`
- Grid is `ACTIVE`
- SellerID SubID matches shard tenant

**During listing updates:**

- `display-shard-meta` and `inventory-shard-meta` MUST match listing owner info

**For stock-sensitive flows:**

- `inventory.stock_count > 0`
- `inventory.reserved == 0` (for certain operations)
- Inventory metadata size within limits

### 14.5 Public Market Integration

The Public Market indexer retrieves listing data from:

- Display Grid shard metadata (title, price, visibility, `updated_at`)
- Inventory Grid metadata (`stock_count`, fulfilment score)
- `listing-meta` (extended description, images)

Ranking logic is influenced by: RI (Identity/Reputation Spec v1.2), fulfilment score, delivery reliability, stock consistency, recent sales velocity, and dispute ratio.

### 14.6 Compliance Notes

DisplayGridNFT and InventoryGridNFT are:

- Full GridNFTs
- Fully compatible with Activation/GCU model
- Shard-rentable
- Upgradable (through Governance)
- Transferable (via GridNFT Sale Contract)

## 15. Diagrams

### 15.1 High-Level Store Listing Lifecycle

```
Tenant (SellerID)
  │
  ▼
Create Listing (metadata)
  │
  ▼
StoreListingVault executes → listing ACTIVE
  │
  ▼
Public Market indexes — display slot visible
  │
  ▼
Listing updated / hidden / archived
```

### 15.2 StoreGrid Three-Layer NFT Architecture

```
StoreGridNFT
  │
  ├──▶ DisplayGridNFT   (Storefront slots)
  └──▶ InventoryGridNFT (Stock & Fulfillment slots)

Each is a full GridNFT with its own GridID, shards,
activation requirements, metadata, and tenant-claimable slots.
```

### 15.3 DisplayGridNFT — Slot Interaction Model

```
Display Grid Slot
  │
  ├──▶ Seller              (controls listing)
  ├──▶ Buyer               (views/clicks)
  └──▶ Public Market Indexer (indexes/ranks listing)

3 active parties per slot.
```

### 15.4 InventoryGridNFT — Slot Interaction Model

```
Inventory Grid Slot
  │
  ├──▶ Seller  (updates stock)
  └──▶ Buyer   (stakes & purchases)

2 active parties per slot.
```

### 15.5 Store Listing Creation Flow

```
Tenant → Create Listing Request
  │
  ▼
Worker validation:
  - Grid active
  - Shard claimed
  - Role = SellerID
  - price >= min_job_price
  - Metadata within limits
  │
  ├── FAIL ──▶ Reject
  └── PASS ──▶ Phantom Mode
```

### 15.6 Phantom Mode Simulation

```
Phantom Mode Simulation:
  - Validate metadata
  - Compute display-grid placement
  - Check inventory-grid binding
  - Preview visibility score
  - Confirm metadata_diff_hash
  │
  ▼
Return simulation_result
```

### 15.7 Vault Execution (StoreListingVault)

```
StoreListingVault
  │
  ├──▶ Create Listing
  │       Writes metadata
  │       Creates listing
  │       Emits receipts
  │       Calls indexer
  │
  ├──▶ Update Listing
  │       Writes metadata
  │       Updates listing
  │       Emits receipts
  │       Calls indexer
  │
  └──▶ Hide / Archive
          status → Hidden/Archived
          Removes from visibility
          Emits receipts
          Indexer updates removal
```

### 15.8 Metadata Model Overview

```
store-listing-meta.ber
  listing_id
  grid_id
  shard_id
  seller_subid
  title
  description
  price
  stock
  image_hashes[]
  created_at
  last_updated
  status  (0=Active, 1=Hidden, 2=Archived)
```

### 15.9 Display Grid Slot Mapping

```
store-listing-meta.ber
  ↕
DisplayGridNFT.shard_meta:
  display_shard_id
  mapped_listing_id
  visibility = ACTIVE
```

### 15.10 Inventory Grid Slot Binding

```
store-listing-meta.ber
  ↕
InventoryGridNFT.shard_meta:
  inventory_shard_id
  stock_count
  reservation_state
  fulfilment metadata
```

Stock MUST always reflect InventoryGrid.

### 15.11 Public Market Indexing Pipeline

```
DisplayGridNFT changes
  │
  ▼
INDEX_HINT sent by Worker:
  - listing_id
  - price
  - RI
  - last_updated
  │
  ▼
Public Market → re-index listing

Indexing occurs on: creation, update, hide/archive
```

### 15.12 Complete Store Listing Lifecycle

```
[Claim Shard]
  │
  ▼
[Create Listing]
  │
  ▼
[ACTIVE] ↔ [UPDATED]
  │
  ▼
[HIDE] (status = Hidden)
  │
  ▼
[ARCHIVED] (permanent removal)

Public Market indexing occurs at every ACTIVE/UPDATED transition.
```

### 15.13 Buyer Stake Requirement (Purchase Context)

```
Buyer Initiates Purchase
  │
  ▼
Buyer stakes payment (escrow)
  │
  ▼
StoreVault begins order workflow

Inventory slot MUST NOT decrement stock
unless buyer escrow is locked.
```

### 15.14 Worker Validation Logic

```
Worker Validates:
  - Grid active
  - Shard claimed by seller
  - SubID = SellerID role
  - Price >= min_job_price
  - Metadata BER valid
  - Stock & images valid
  - Inventory shard exists
  - Listing count <= max_listings_per_shard
  │
  ├── FAIL ──▶ Reject
  └── PASS ──▶ Phantom Mode Simulation
```

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/runtime/ber-schema-definitions-v1.2-document-b.md`
- `/docs/economics/marketplace-fee-table-v1.0.md`
- `/docs/nft/gridnft-standards-v1.3.md`
