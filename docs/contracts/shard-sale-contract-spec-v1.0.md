---
title: GridCoDe — Shard Sale Contract Specification
version: v1.0
status: Active Binding
domain: Contracts
layer: Contract Specification — ShardSaleVault
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Shard Sale Contract Specification

## 1. Purpose

A Shard Sale Contract enables a current shard tenant (`tenant_subid`) to sell their shard occupancy rights to a buyer SubID of the same role type, for the remainder of the current grid activation epoch.

This is distinct from GridNFT sale (ownership transfer of an entire grid) and from shard rental (initial tenancy acquisition). Shard Sale is mid-epoch tenancy transfer between two qualifying SubIDs.

The shard buyer becomes the new tenant and inherits: listing rights (StoreGrid), service rights (ServiceGrid), offer creation rights (TradeGrid), challenge creation rights (ChallengeGrid), and loan interaction rights (LendingGrid).

Epoch constraints: the epoch does NOT reset. Stake (`S_p`) migrates from seller to buyer. No other shard-level state is disturbed.

## 2. Preconditions

Workers MUST enforce the following before allowing a shard sale:

**Seller side**

- `shard-meta.state == CLAIMED`
- `tenant_subid == seller_subid`
- Seller has no active vault-level disputes referencing this shard where `seller_subid` is the obligated party. This covers disputes originating from any market vault (StoreVault, TradeVault, LendingVault, ChallengeVault) that are bound to this shard and have not been resolved or closed.
- Seller role matches grid type
- Seller has no pending shard sale TX for the same shard

**Buyer side**

- Buyer role MUST match grid type
- Buyer MUST have sufficient funds for `S_p` stake lock
- Buyer RI MUST meet minimum threshold
- Buyer MUST NOT be currently locked
- Buyer MUST NOT already hold another shard in the same grid (governance-configurable)

**Shard and grid**

- Shard MUST NOT be in `LOCKED` state
- Grid MUST be `ACTIVE`
- Grid MUST NOT be in `FINALIZING` state

If any check fails, Workers MUST reject before Phantom Mode.

## 3. Metadata Structures (BER)

### 3.1 shard-meta.ber — Mutations on Sale

```
ShardMeta:
  shard_id:      u64    # immutable
  grid_id:       u64    # immutable
  tenant_subid:  u64    # updated to buyer_subid
  state:         u8     # CLAIMED → CLAIMED (unchanged)
  created_at:    u64    # immutable
  last_updated:  u64    # updated to block_timestamp
```

Only `tenant_subid` and `last_updated` change. `state` remains `CLAIMED` throughout. `shard_id`, `grid_id`, and `created_at` are immutable.

### 3.2 shard-sale-meta.ber — Auxiliary Record

```
ShardSaleMeta:
  version:      u8
  checksum:     u128
  shard_id:     u64
  grid_id:      u64
  seller_subid: u64
  buyer_subid:  u64
  price:        u64
  status:       u8    # 0=Listed, 1=Closed, 2=Cancelled
  created_at:   u64
  last_updated: u64
```

`shard-sale-meta` is created when the seller lists the shard and archived when `status` reaches `Sold` or `Cancelled`.

### 3.3 Mutation Boundaries

Workers MUST enforce: only `tenant_subid` and `last_updated` in `shard-meta` may be written by this contract. No other `shard-meta` fields, no `grid-meta` fields, and no other shard records may be touched.

## 4. Contract FSM (Sale Lifecycle)

```
INIT → LISTED → CLOSED
          │
          └──▶ CANCELLED
```

| From | Action | To |
|---|---|---|
| `INIT` | `list_shard` | `LISTED` |
| `LISTED` | `buy_shard` | `CLOSED` |
| `LISTED` | `cancel` | `CANCELLED` |

`CLOSED` and `CANCELLED` are terminal states. `SOLD` is not a persisted FSM state — the Vault execution block performs all stake migration, metadata update, and payout atomically, then commits directly to `CLOSED`. No intermediate `SOLD` state is written on-chain.

## 5. Phantom Mode Simulation

Phantom Mode MUST simulate:

- Buyer balance sufficiency
- Marketplace fee computation (1% total)
- `S_p` stake migration (seller unlock, buyer lock)
- Metadata diff
- New tenant rights
- Epoch timing (unchanged)
- Payout map
- Simulation parity hash

Simulation output:

```
simulation_result:
  shard_id
  seller_subid
  buyer_subid
  price
  treasury_fee
  sponsor_fee
  seller_payout
  metadata_diff_hash
  new_tenant: buyer_subid
```

Workers MUST enforce strict simulation → execution parity.

## 6. Vault Execution

Executed by ShardSaleVault. All steps MUST occur within a single atomic execution block — no partial commit is permitted.

1. Revalidate at commit time (unconditional):
   - `shard-meta.state == CLAIMED`
   - `shard-meta.tenant_subid == seller_subid`
   - Buyer does not already hold a shard in this grid (over-occupancy recheck — prevents concurrent acquisition race)
2. Debit buyer price
3. Compute and route fees: `treasury_fee = 0.5%`, `sponsor_fee = 0.5%`
4. Unlock seller `S_p`
5. Lock buyer `S_p` into shard
6. Update `shard-meta`: `tenant_subid = buyer_subid`, `last_updated = block_timestamp`, `state = CLAIMED` (unchanged)
7. Update `shard-sale-meta.status = Closed`
8. Construct multi-recipient payout TX:

```
[
  {seller_subid,  price - treasury_fee - sponsor_fee},
  {treasury,      treasury_fee},
  {sponsor_subid, sponsor_fee}
]
```

9. Emit `ReceiptPreconfirm`
10. Commit transaction
11. Emit `ReceiptConfirm`

## 7. Fee Model

Shard sale is a value transfer and uses the standard marketplace fee:

| Recipient | Rate |
|---|---|
| Treasury | 0.5% |
| Sponsor | 0.5% |
| **Total** | **1%** |

Fee is charged on gross sale price. Seller receives `price − 1%`. Consistent with GridNFT Sale fee structure and Marketplace Fee Table v1.0.

## 8. Stake Migration (`S_p`)

When a shard is sold, stake migrates atomically in the same Vault execution block:

- Seller's locked `S_p` is unlocked and returned to seller
- Buyer's `S_p` is locked into the shard
- Shard remains `CLAIMED` under buyer

```
Before:   seller S_p LOCKED,   buyer S_p AVAILABLE
After:    seller S_p UNLOCKED, buyer S_p LOCKED into shard
```

No yield distortion occurs because the epoch clock does not reset, and yield weight calculations are governed by Landlord–Tenant Yield Model v1.0. Weight contribution timing and proration for mid-epoch stake migration are defined exclusively in that model and MUST be deterministic. Weight recalculation MUST occur within the same atomic Vault execution block as stake migration — no deferred weight update is permitted.

## 9. Continuity Guarantees

A shard sale MUST NOT:

- Invalidate existing product listings
- Interrupt active service jobs
- Cancel live trade offers
- Undo pending disputes
- Erase challenge submissions
- Overwrite loan records

The new tenant inherits the ongoing market state, local metadata, and role obligations of the shard. Workers MUST enforce strict immutability of all vault-specific metadata during and after the sale. The system does not reset or clear any shard-level state.

## 10. Deep-Link Routing

Deep-links use the canonical `gridcode://` scheme.

**List shard for sale:**

```
gridcode://shard-sale/<grid_id>/<shard_id>?role=<SubID_role>
```

| Param | Purpose |
|---|---|
| `grid_id` | Identify grid |
| `shard_id` | Identify shard |
| `role` | Buyer role must match grid type |
| `return_url` | Optional |

Workers resolve: `grid-meta`, `shard-meta`, `shard-sale-meta`, SubID roles.

## 11. Worker Validation Rules

Workers MUST validate:

**Seller side:**

- `seller_subid == shard-meta.tenant_subid`
- `shard-meta.state == CLAIMED`
- No disputes or locks on shard
- Seller role matches grid type

**Buyer side:**

- Buyer role matches grid type
- Buyer RI ≥ threshold
- Buyer `S_p` stake available
- `price ≥ min_job_price`
- Buyer not over-occupied (governance-configurable limit)

**Metadata:**

- `shard-sale-meta` checksum valid
- `shard-meta` mutation restricted to `tenant_subid` and `last_updated` only
- Grid type compatible with both roles

**Execution:**

- Payout map sums to `price`
- `metadata_diff_hash` matches simulation
- `shard-meta.state == CLAIMED` and `tenant_subid == seller_subid` reconfirmed at commit time

## 12. Security Model

| Threat | Defense |
|---|---|
| Shard hijacking | Worker `tenant_subid` check and role validation |
| Double-selling | Worker locks `shard-sale-meta.status`; commit-time revalidation |
| Stake bypass | Atomic `S_p` unlock–lock enforcement in single Vault block |
| Race with shard rental | Shard `LOCKED` state prevention at precondition check |
| Parallel sale exploit | Commit-time `shard-meta.tenant_subid == seller_subid` recheck |
| Replay attacks | Receipt hashes and nonce enforcement |
| Metadata tampering | BER checksum and immutability enforcement |
| Continuity violation | Vault-specific metadata immutability enforced during sale |
| Epoch manipulation | Epoch timer sourced from `GlobalConfig`; contract has no write access |

## 13. Receipt Structure

**shard-sale-preconfirm.ber fields:**

```
grid_id
shard_id
seller_subid
buyer_subid
price
simulation_hash
timestamp
```

**shard-sale-confirm.ber fields:**

```
grid_id
shard_id
new_tenant_subid
payout_map_hash
block_height
timestamp
```

## 14. Compliance Summary

This contract is fully compliant with:

- Whitepaper v3.0
- Technical Addendum v3.1
- GCSPEC v1.1
- Runtime Architecture v1.1
- Marketplace Fee Table v1.0
- GridNFT Standards v1.3
- Identity & Reputation Spec v1.2
- Activation/GCU Framework v1.0
- Landlord–Tenant Yield Model v1.0

Shard sale is supported by the system's economic invariants without disturbing epoch continuity, yield weight, or downstream market state.

## 15. Diagrams

### 15.1 High-Level Shard Sale Flow

```
Seller (current tenant) → List Shard for Sale
  │
  ▼
Worker validates listing request
  │
  ▼
Shard enters LISTED state
  │
  ▼
Buyer initiates purchase
  │
  ▼
Phantom Mode Simulation:
  - Price
  - Fees
  - Stake migration preview
  - New tenant preview
  - metadata_diff_hash
  │
  ▼
Buyer Signs TX
  │
  ▼
ShardSaleVault Executes
  │
  ▼
tenant_subid → buyer_subid (state remains CLAIMED)
```

### 15.2 FSM Diagram

```
INIT
  │  list_shard
  ▼
LISTED
  │  \
buy  \  cancel
  │   ▼
  │  CANCELLED (terminal)
  ▼
CLOSED (terminal)

Note: No intermediate SOLD state is written on-chain.
Vault execution commits directly from LISTED → CLOSED.
```

### 15.3 Metadata Touchpoints

```
shard-meta.ber
  shard_id                  ← immutable
  grid_id                   ← immutable
  tenant_subid              ← updated to buyer_subid on sale
  state                     ← CLAIMED → CLAIMED (unchanged)
  created_at                ← immutable
  last_updated              ← updated to block_timestamp

shard-sale-meta.ber (auxiliary)
  shard_id
  grid_id
  seller_subid
  buyer_subid
  price
  status                    LISTED → CLOSED / CANCELLED
  created_at
  last_updated
```

### 15.4 Preconditions Flow

```
Seller → List Shard
  │
  ▼
Worker Preconditions:
  - shard.state == CLAIMED
  - seller_subid == tenant_subid
  - No pending disputes
  - Grid ACTIVE, not FINALIZING
  - Shard not LOCKED
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ LISTED

Buyer → Buy Shard
  │
  ▼
Worker Preconditions:
  - Buyer role matches grid type
  - Buyer RI >= threshold
  - Buyer S_p available
  - Buyer not over-occupied
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Phantom Mode Simulation
```

### 15.5 Phantom Mode Simulation Pipeline

```
Buyer → Buy Shard
  │
  ▼
Phantom Simulation:
  - Check buyer balance
  - Compute marketplace fees (1% total)
  - Preview seller payout
  - Preview S_p stake migration
  - Compute metadata_diff_hash
  - Preview shard tenant change
  │
  ▼
Return simulation_result to UI

Simulation MUST match final execution exactly.
```

### 15.6 Vault Execution (ShardSaleVault)

```
ShardSaleVault — single atomic block:
  │
  ├── 0. Revalidate: shard.state == CLAIMED, tenant_subid == seller
  ├── 1. Debit buyer price
  ├── 2. Deduct marketplace fees (1%)
  ├── 3. Unlock seller S_p
  ├── 4. Lock buyer S_p into shard
  ├── 5. Update shard-meta:
  │       tenant_subid = buyer_subid
  │       state        = CLAIMED (unchanged)
  │       last_updated = block_timestamp
  ├── 6. Update shard-sale-meta: status = Closed
  ├── 7. Multi-recipient payout TX:
  │       [{seller, price - fees}, {treasury, fee}, {sponsor, fee}]
  ├── 8. Emit ReceiptPreconfirm
  ├── 9. Commit transaction
  └── 10. Emit ReceiptConfirm
```

### 15.7 Fee Model

```
Sale Price = P
Total Fee  = 1% of P

  ┌──────────────────────────────┐
  │       1% Fee Split           │
  ├─────────────────┬────────────┤
  │    Sponsor      │  Treasury  │
  │      0.5%       │    0.5%    │
  └─────────────────┴────────────┘

Seller receives: P × 99%
```

### 15.8 Stake Migration

```
Before Sale:
  Seller: S_p LOCKED into shard
  Buyer:  S_p AVAILABLE in wallet

Atomic migration (single Vault block):
  Seller S_p ──▶ UNLOCKED ──▶ returned to seller
  Buyer  S_p ──▶ LOCKED   ──▶ into shard

After Sale:
  Seller: S_p UNLOCKED
  Buyer:  S_p LOCKED
  shard-meta.tenant_subid = buyer_subid
```

### 15.9 Shard Continuity

```
Shard Sale Occurs
  │
  ▼
Inherited by buyer (unchanged):
  - Store listings remain active
  - Service tasks remain active
  - Trade offers remain active
  - Challenges remain active
  - Loans remain in vault

The system does NOT reset or clear any shard-level state.
New tenant inherits ongoing market state and role obligations.
```

### 15.10 Deep-Link Routing

```
gridcode://shard-sale/<grid_id>/<shard_id>?role=<SubID_role>
  │
  ▼
Worker resolves: grid-meta, shard-meta, sale-meta, SubID roles
  │
  ▼
UI → Phantom Simulation → TX → ShardSaleVault
```

### 15.11 Worker Enforcement Layer

```
Worker Enforcement:

SELLER:
  - Must be current tenant (tenant_subid match)
  - shard.state == CLAIMED
  - No disputes or locks
  - Valid role for grid type

BUYER:
  - Valid role for grid type
  - RI >= threshold
  - S_p available
  - Not over-occupied (governance option)

METADATA:
  - sale-meta checksum valid
  - shard-meta mutation on allowed fields only

EXECUTION:
  - Payout map sums to price
  - metadata_diff_hash parity with simulation
  - Commit-time revalidation of seller tenancy

  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Vault Execution
```

### 15.12 Security Threats & Defenses

```
THREAT                          DEFENSE
Shard hijacking              →  Worker tenant_subid + role check
Double-selling               →  sale-meta.status lock + commit recheck
Stake bypass                 →  Atomic S_p unlock/lock in single block
Race with shard rental       →  LOCKED state prevention at precondition
Parallel sale exploit        →  Commit-time seller tenancy revalidation
Replay attacks               →  Receipt hashes + nonce enforcement
Metadata tampering           →  BER checksum + immutability enforcement
Continuity violation         →  Vault-specific metadata immutability
```

### 15.13 Full Shard Sale Lifecycle

```
Seller → list_shard
  │
  ▼
LISTED
  │
  ▼ (Buyer → buy_shard)
Phantom Mode Simulation
  │
  ▼
Buyer Signs TX
  │
  ▼
ShardSaleVault executes:
  revalidate → debit → fees → S_p migrate → meta update → payout TX
  │
  ▼
ReceiptConfirm
  │
  ▼
CLOSED

Buyer operates shard for remainder of epoch.
Epoch end → EXPIRED → S_p unlocked (as per Grid Activation contract).
```

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/contracts/shard-rental-contract-spec-v1.0.md`
- `/docs/contracts/grid-activation-contract-spec-v1.0.md`
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/runtime/ber-schema-definitions-v1.2-document-a.md`
- `/docs/economics/marketplace-fee-table-v1.0.md`
- `/docs/economics/landlord-tenant-yield-model-v1.0.md`
- `/docs/nft/gridnft-standards-v1.3.md`
