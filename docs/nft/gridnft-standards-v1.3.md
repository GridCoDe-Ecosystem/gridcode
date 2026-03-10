---
title: GridCoDe GridNFT Standards & Market-Specific Grid Types
version: v1.3
status: Active Binding
domain: NFT
layer: Grid Taxonomy & Vault Routing Model
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: gridnft-standards-v1.2.md
requires:
  - /docs/runtime/contract-specification-gcspec-v1.1.md
  - /docs/identity/subid-role-technical-spec-v1.2.md
  - /docs/runtime/ber-schema-definitions-v1.2-document-a.md
last_reviewed: 2026-02
---

# GridCoDe GridNFT Standards & Market-Specific Grid Types

## 1. GridNFT Concept

Grids are programmable, deterministic economic templates. Each GridNFT defines:

- `category` — the market type this grid serves
- `shard_composition` — size and layout of the grid
- `reward_model` — yield and weight formula
- `grid_size` — shard count
- `vault_mapping` — which Vault family handles this grid's transactions
- `permitted_subids` — which SubID roles may operate in this grid
- `economic_purpose` — canonical description of the grid's function

## 2. GridNFT Type Table

| Type ID | Grid Category | Vault Family | Description |
|---|---|---|---|
| 0 | StoreGrid | StoreVault | Standard digital store grid |
| 0A | DisplayGrid | StoreVault (UI-visible) | Public-facing storefront and listing grid |
| 0B | InventoryGrid | StoreVault (internal ops) | Inventory, SKUs, stock and fulfillment grid |
| 1 | ServiceGrid | ServiceVault | On-chain gig economy and services |
| 2 | ChallengeGrid | ChallengeVault | Competitions and rewards |
| 3 | TradeGrid | TradeVault | P2P trading booths |
| 4 | LendingGrid | LendingVault | Collateralized lending |
| 5 | InsuranceGrid | InsuranceVault | Risk markets and claims |
| 6 | ActivationGrid | ActivationVault | Grid activation and epochs |
| 7 | LiquidityGrid | LiquidityVault (future) | Group savings and liquidity |
| 8 | EducationGrid | ServiceVault variant | Courses, teaching, mentorship |
| 9 | GovernanceGrid | GovernanceVault | DAO operations |
| 10 | CustomGrid | Any valid Vault family | Community-defined grids |

DisplayGridNFT (0A) and InventoryGridNFT (0B) are formal GridNFT types under the StoreGrid family as of v1.3.

## 3. Internal Structure of a GridNFT

### 3.1 Core Structure

All GridNFTs share the same structural foundation:

```markdown
grid-meta.ber {
  grid_id
  grid_type
  sponsor_subid
  expiry_timestamp
  shard_ids[]
  vault_mapping
  reward_model
  permitted_subids[]
}
```

### 3.2 Multi-Grid Store Architecture

The StoreGrid family uses a three-layer NFT architecture coordinated by the StoreGridNFT umbrella:

```markdown
StoreGridNFT (umbrella)
  |
  +-- DisplayGridNFT (public slot structure)
  |
  +-- InventoryGridNFT (seller inventory structure)
```

Workers treat DisplayGridNFT and InventoryGridNFT as separate GridNFTs but link them via `sponsor_subid`, `store_id` reference, and shard linking.

```markdown
DisplayGrid  → visible storefront slots
InventoryGrid → SKU, stock, and fulfillment logic
```

## 4. DisplayGridNFT Specification

### 4.1 Purpose

Defines the public-facing storefront visible to buyers in Private Marketplace storefronts and the Public Market global listings.

### 4.2 Vault Mapping

StoreVault — read-only until an action triggers listing creation.

### 4.3 SubID Roles

- SellerID
- SponsorID (for visibility controls)

### 4.4 Shard Layout

Default: 10×10 (100 display slots).

Each display shard:

- Holds a displayed listing reference
- Links to `listing-meta.ber`
- Integrates VI ranking
- Participates in `reward_model` for Sponsor share

### 4.5 Key Behaviours

- Determines what is visible publicly
- Controls store layout and catalog organisation
- Indexed by Public Market indexing logic
- Contains visibility override metadata (optional)
- Does NOT handle fulfillment or stock

### 4.6 Metadata Extension

```typescript
interface DisplayGridMeta {
  display_slots:       string[]    // shard_ids
  layout_style:        LayoutEnum
  visibility_modifier: number | null
  store_id:            bigint      // links to InventoryGrid
}
```

## 5. InventoryGridNFT Specification

### 5.1 Purpose

Defines internal product structure and stock logic for sellers. Used for SKU grouping, stock quantity, version control, product bundles, availability windows, and inventory-ledger anchoring.

Workers use InventoryGrid to validate quantity updates, sold-out logic, and out-of-sync listing issues.

### 5.2 Vault Mapping

StoreVault — write operations for seller-side updates.

### 5.3 SubID Roles

- SellerID
- SponsorID (optional supervisory rights)

### 5.4 Shard Layout

Configurable: 2×2, 4×4, or 10×10 depending on catalog size.

### 5.5 Key Behaviours

- Defines how many products a seller can stock
- Enforces digital product availability windows
- Ensures `listing-meta` has a valid inventory source
- Orchestrates SKU-level state (active, paused, archived)
- Prevents illegal listings via Worker guardrails

### 5.6 Metadata Extension

```typescript
interface InventoryGridMeta {
  sku_slots:            string[]   // shard_ids
  sku_groups:           string[]   // group_ids
  max_sku_count:        number
  auto_archive:         boolean
  linked_display_grid:  bigint
}
```

## 6. StoreGridNFT Definition (Umbrella)

StoreGridNFT coordinates:

- DisplayGridNFT
- InventoryGridNFT
- StoreVault listing execution
- Sponsor `reward_model`
- Seller SubID permissions

```markdown
StoreGrid  = the Marketplace
DisplayGrid = the Storefront
InventoryGrid = the Warehouse
```

## 7. Vault Routing Model

Workers resolve StoreMarketplace actions as:

```markdown
Action received
  → Worker loads metadata
  → If public-facing: route to DisplayGridNFT
  → If seller-side: route to InventoryGridNFT
  → If transactional: route to StoreVault
```

This preserves deterministic Vault behaviour, modular metadata, and clean visual and backend separation.

## 8. Shard Claim Rules for Display and Inventory Grids

| Grid Type | Tenant Role | Operation |
|---|---|---|
| DisplayGrid | SellerID | MAY fill slots with external listing references |
| InventoryGrid | SellerID | MAY allocate SKU slots and update stock metadata |

SponsorID MAY lock slots in either grid for promotional or premium visibility.

## 9. Reward Model Extension

DisplayGridNFT contributes to Sponsor share — `sponsor_rate` applies to all display-based transactions.

InventoryGridNFT contributes indirectly — inventory slots do NOT generate yield directly, but correct inventory enables more sales, which routes through Sponsor earning.

## 10. Public Market Indexing

The Public Market indexes DisplayGrid slots only — not InventoryGrid slots.

```markdown
public_index = DisplayGridMeta.visible_slots
```

Reason: DisplayGrid is public. InventoryGrid is internal. `listing-meta` references both.

## 11. Store Frontend UI Routing

```markdown
Public Market → DisplayGridNFT → Listing → InventoryGridNFT (SKU validation)
```

## 12. Architecture Diagrams

### 12.1 Master GridNFT Architecture

```markdown
+--------------------------------------+
| GridNFT Template                     |
| (grid-meta.ber: grid_id, type, ...)  |
+------------------+-------------------+
                   |
          Instantiate Grid (Activation)
                   |
                   v
+--------------------------------------+
| Active Grid Instance                 |
|  - grid_id                           |
|  - expiry                            |
|  - shard_ids[]                       |
+----------+-------------+-------------+
           |             |
           v             v
+------------------+ +------------------+
| shard-meta.ber   | | shard-meta.ber   |
| tenant_subid,    | | tenant_subid,    |
| state            | | state            |
+--------+---------+ +--------+---------+
         |                    |
         v                    v
+------------------+   +------------------+
| Vault Router     |-->| Vault FSM Exec   |
+------------------+   +------------------+
```

Caption: master lifecycle from GridNFT template to active grid to shard metadata to Vault routing.

### 12.2 Grid-Type Routing

```markdown
GridNFT.grid_type --> Router --> Vault Family
--------------------------------------------------
STORE      --> StoreGrid / Display / Inventory --> StoreVault
SERVICE    --> ServiceGrid                     --> ServiceVault
TRADE      --> TradeGrid                       --> TradeVault
CHALLENGE  --> ChallengeGrid                   --> ChallengeVault
LENDING    --> LendingGrid                     --> LendingVault
INSURANCE  --> InsuranceGrid                   --> InsuranceVault
ACTIVATION --> ActivationGrid                  --> ActivationVault
LIQUIDITY  --> LiquidityGrid (future)          --> LiquidityVault
EDUCATION  --> EducationGrid                   --> ServiceVault variant
GOVERNANCE --> GovernanceGrid                  --> GovernanceVault
CUSTOM     --> CustomGrid                      --> Any allowed Vault
```

Caption: canonical mapping of Grid types to Vault families — Worker routing rules.

### 12.3 StoreGrid Family

```markdown
StoreGridNFT (grid-meta)
  |
  +-------------------------------+
  |                               |
  v                               v
DisplayGridNFT              InventoryGridNFT
(public storefront slots)   (seller SKU / stock slots)
  |                               |
display-shard-meta[n]       inventory-shard-meta[n]
  |                               |
  v                               v
listing-meta.ber ----------> listing validation
  |                               |
  +-----------> StoreVault FSM <--+
               (purchase, escrow, payout)
```

Caption: StoreGrid umbrella and linkage between Display and Inventory grids and StoreVault.

### 12.4 DisplayGridNFT Detail

```markdown
DisplayGridNFT (10×10 default)
+--------------------------------------------------+
| slot-01 | slot-02 | ... | slot-100              |
+--------------------------------------------------+

Each slot:
display-shard-meta {
  shard_id
  linked_listing_id
  visibility_modifier?
  sponsor_promo_flag?
}

Public Market indexes: DisplayGrid slots → listing references
```

Caption: public-facing grid — what is indexed and shown in the Public Market.

### 12.5 InventoryGridNFT Detail

```markdown
InventoryGridNFT (configurable NxN)
+--------------------------------------------------+
| sku-01 | sku-02 | ... | sku-N                   |
+--------------------------------------------------+

Each sku slot:
inventory-shard-meta {
  shard_id
  sku_id
  stock_level
  availability_window
  version_hash
}
```

Caption: inventory slots and SKU ledger that back DisplayGrid-visible listings.

### 12.6 Listing Creation Sequence

```markdown
Seller UI: create listing
  → Worker validates listing-meta.ber
  → Phantom Mode simulate → (ok?)
  → Write listing-meta
  → Link to InventoryGrid SKU slot (lock stock if needed)
  → Add/assign display slot (DisplayGridShard → linked_listing_id)
  → Public Market index updated (DisplayGrid slot visible)
```

Caption: canonical listing lifecycle ensuring Worker validation, Phantom Mode parity, and cross-grid linking.

### 12.7 Purchase and Fulfillment Sequence

```markdown
Buyer selects DisplayGrid slot
  → fetch listing-meta
  → Phantom Mode sim
  → StoreVault: Create Order (order.ber) + escrow state
  → InventoryGrid: decrement/reserve stock (inventory-shard update)
  → Seller fulfills → evidence → Buyer confirms
  → StoreVault: release payout (multi-recipient TX) → update receipts
  → Workers: update RI, activity metrics (for epoch weight)
```

Caption: transaction sequence showing atomic multi-recipient payout and inventory updates.

### 12.8 Activation and Epoch Flow

```markdown
Treasury seeds ActivationBatch (S_gc per slot)
  → Sponsors claim ActivationSlot (stake S_sp)
  → GridNFT → ActivationVault: ACTIVATE (grid becomes ACTIVE)
  → Shards become claimable → Tenants stake S_p and occupy shards
  → Epoch runs → Market activity recorded (Workers collect A_i)
  → Epoch end → RewardVault computes Y → distribute by weights
  → Return principals (S_gc, S_sp, S_p) to owners
```

Caption: ActivationBatch to activation to epoch to yield distribution lifecycle.

### 12.9 Reward and Weight Model

```markdown
Inputs:
  S_gc   (treasury seed)
  S_sp   (sponsor stake)
  S_p_i  (tenant stakes)
  RI_i   (reputation index snapshot)
  A_i    (activity score)
  TB_i   (TrustBond)

Compute:
  w_p_i   = S_p_i × m_ri_i × m_a_i × m_t_i
  w_sp    = S_sp × m_sp
  W_total = S_gc + w_sp + Σ w_p_i

  Each actor share = Y × (actor_weight / W_total)
```

Caption: canonical yield formula and multipliers. See `/docs/economics/economics-incentive-model-v1.1.md`.

### 12.10 TradeGrid

```markdown
TradeGridNFT (many 1×1 shards)
shard (TraderID) <-----> trade-offer.ber
       |                       |
       v                       v
TradeVault FSM:
  CREATE → ESCROW → RELEASE / CANCEL / DISPUTE
  (Partial fills allowed; multi-party settlement when necessary)
```

Caption: TradeGrid booth model and TradeVault FSM.

### 12.11 ServiceGrid

```markdown
ServiceGridNFT (shards: providers)
Requester → create ServiceTask (service-task.ber)
  → Provider accepts → lock TrustBond (if required)
  → Provider submits evidence → Requester reviews
       |                  \
       v                   v
  Approve → Pay     Reject → Dispute → Vault evaluation → Outcome
```

Caption: Service task lifecycle, TrustBond interactions, and deterministic dispute resolution.

### 12.12 GovernanceGrid

```markdown
User / SubID proposes → governance-meta.ber (proposal draft)
  → GovernanceVault: PROPOSAL_ACTIVE
  → Voting (Role coefficients × stake × RI multiplier)
  → Proposal: Passed / Failed
  → EXECUTION_PENDING → EXECUTED (metadata updates)
```

Caption: governance FSM and role-weighted voting model.

### 12.13 Metadata Flow and BER Objects

```markdown
User action → Worker loads:
  - grid-meta.ber
  - shard-meta.ber
  - listing-meta.ber / service-task.ber / order.ber / challenge-state.ber

Worker validates BER and checksum
  → Phantom Mode sim
  → TX signing
  → Vault execution
  → State-domain write (BER update)
  → Worker re-index
```

Caption: canonical metadata pipeline — BER validation to Phantom Mode to Vault commit to Worker re-index.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — NFT & Grid Taxonomy
**Last Reviewed:** 2026-02
**Supersedes:** gridnft-standards-v1.2.md
**Requires:**
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/runtime/ber-schema-definitions-v1.2-document-a.md`
- `/docs/economics/economics-incentive-model-v1.1.md`
