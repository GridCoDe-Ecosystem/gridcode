---
title: GridCoDe — Trade Offer Contract Specification
version: v1.0
status: Active Binding
domain: Contracts
layer: Contract Specification — TradeVault
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Trade Offer Contract Specification

## 1. Purpose

The Trade Offer Contract allows a TraderID SubID, occupying a shard in a TradeGrid (via Shard Rental Contract), to:

- Create trade offers
- Specify the asset they give and the asset they want
- Define rates, amounts, limits, and expiry
- Publish offers to the Public Market
- Accept or match offers with buyers
- Settle exchanges atomically through TradeVault
- Pay marketplace fees (1%) via multi-recipient TX
- Update activity score for Landlord–Tenant yield

A trade offer is a state machine contract governing atomic crypto swaps between two matching SubIDs.

## 2. Preconditions

Workers MUST enforce the following conditions before Phantom Mode:

**Grid-level**

- Grid MUST be `ACTIVE`
- Grid type MUST be `TradeGrid`
- Shard MUST be `CLAIMED`

**Trader identity**

- SubID MUST have role `TraderID`
- SubID MUST match shard tenant (`tenant_subid`)
- SubID MUST meet minimum RI threshold (`minimum_trader_ri`)

**Offer validity**

- `give_amount` > 0
- `want_amount` > 0
- `rate` > 0
- Asset types MUST be valid and recognized
- `give_asset` MUST NOT equal `want_asset` (self-trade prohibition)
- `price` MUST NOT violate `min_job_price` (GNC leg)
- Metadata size MUST be ≤ `max_metadata_size`

**Trader balance checks** (depending on offer type)

- Sufficient locked or available asset for offer creation
- Restrictions for "post-only" vs "escrow-first" offers apply

**Concurrent trade limit**

- Trader MUST NOT operate more than N simultaneous unfinalized escrowed offers (configurable)

If any check fails, Workers MUST reject before simulation.

## 3. Metadata Structure (BER)

### 3.1 Formal Schema — trade-offer-meta.ber

```
TradeOfferMeta:
  offer_id:             u64
  grid_id:              u64
  shard_id:             u64
  trader_subid:         u64
  give_asset:           u8    # asset type ID
  give_amount:          u128
  want_asset:           u8
  want_amount:          u128
  min_fill:             u128
  max_fill:             u128
  expiry_timestamp:     u64
  status:               u8    # 0=ACTIVE, 1=PARTIAL, 2=FILLED, 3=CANCELLED, 4=EXPIRED
  created_at:           u64
  last_updated:         u64
```

### 3.2 Allowed Mutations

| Field | Condition |
|---|---|
| `status` | Any valid FSM transition |
| `give_amount` | Partial fills only |
| `want_amount` | Partial fills only |
| `last_updated` | Any write |

### 3.3 Forbidden Mutations

The following fields MUST remain immutable:

- `offer_id`
- `trader_subid`
- `grid_id`
- `shard_id`
- `give_asset`
- `want_asset`

## 4. Contract FSM (Trade Offer Lifecycle)

```
INIT → ACTIVE → PARTIAL* → FILLED
          │                    │
          └──▶ CANCELLED       └──▶ (archived)
          └──▶ EXPIRED
```

| State | Meaning |
|---|---|
| `ACTIVE` | Offer is live and visible |
| `PARTIAL` | Partially filled; remaining amount live |
| `FILLED` | Fully executed |
| `CANCELLED` | Manually removed by trader |
| `EXPIRED` | Automatically removed after `expiry_timestamp` |

`FILLED`, `CANCELLED`, and `EXPIRED` are terminal states. `CLOSED` is a logical archival condition used in diagrams to denote finality — it is not a distinct encoded `status` value.

Partial fills MUST:

- Adjust `give_amount` and `want_amount` proportionally
- Maintain rate invariants across all fill operations

## 5. Phantom Mode Simulation

When a buyer selects an offer, Phantom Mode MUST simulate:

- Rate and amount correctness
- Fee computation (1%)
- Escrow correctness
- Multi-output settlement map
- `metadata_diff_hash`
- Partial fill state
- Trade expiry check
- SubID role validation

Simulation output:

```
simulation_result:
  offer_id
  maker_subid
  taker_subid
  give_asset
  want_asset
  fill_amount
  seller_payout
  buyer_receive
  sponsor_fee
  treasury_fee
  metadata_diff_hash
  final_status  # ACTIVE | PARTIAL | FILLED
```

Workers MUST enforce strict simulation → execution parity.

## 6. Vault Execution (TradeVault)

Trade settlement is executed by TradeVault. Steps (Maker = offer creator, Taker = acceptor):

Both asset transfer legs MUST execute atomically within a single TradeVault execution block. Partial transfer of one leg without the other is prohibited. Expiry MUST be revalidated immediately before Vault commit; if `expiry_timestamp` has passed between simulation and commit, execution MUST fail.

1. Lock buyer/taker stake (if required)
2. Transfer assets: maker gives → taker; taker gives → maker (atomic, both legs)
3. Deduct fees (1% total): `sponsor_fee = 0.5%`, `treasury_fee = 0.5%`
4. Construct multi-recipient payout TX:

```
[
  {maker_subid,  maker_receive_amount},
  {taker_subid,  taker_receive_amount},
  {sponsor_subid, sponsor_fee},
  {treasury,      treasury_fee}
]
```

5. Emit `ReceiptPreconfirm`
6. Update `trade-offer-meta` (reduce amounts or set `FILLED`)
7. Commit TX
8. Emit `ReceiptConfirm`

All changes MUST match simulation output.

## 7. Fee Model

Trade Market default fee schedule: **1% total fee**, charged on gross value of the taker → maker transfer.

| Recipient | Rate |
|---|---|
| Sponsor | 0.5% |
| Treasury | 0.5% |

Applies to: full fills, partial fills, maker/taker swapped assets.

## 8. Anti-Fraud & Anti-Front-Run Rules

Workers MUST enforce:

- Nonce and pending TX ordering — prevents double acceptance of the same offer and parallel taker race conditions
- Expiry validation — offer is automatically invalid after `expiry_timestamp`
- Rate freeze during Phantom Mode — rate used in simulation MUST match execution exactly
- Maker/taker identity validation — SubID signatures required; prevents impersonation
- Replay prevention through `metadata_diff_hash`
- Immutability of all forbidden fields

## 9. Public Market Integration

The Public Market indexer scans `trade-offer-meta` and generates searchable listings at:

```
public-market-index/trade/offers/<offer_id>.json
```

Indexer fields: `give_asset`, `want_asset`, rate, `trader_ri`, expiry, `created_at`, ranking weight (optional).

Offers are removed from the index when `status` transitions to `FILLED`, `CANCELLED`, or `EXPIRED`.

## 10. Worker Validation Rules

Workers MUST validate:

**On Offer Creation:**

- Role = `TraderID`
- Shard claimed by `trader_subid`
- Grid is `ACTIVE`
- `give_amount` and `want_amount` > 0
- `rate` > 0
- Metadata size within limits

**On Partial Fill:**

- Remaining offer amounts are valid
- Metadata diff matches simulation

**On Full Fill:**

- Amounts exactly consumed
- Payout map sums correctly

**On Cancel:**

- Only `trader_subid` MAY cancel

## 11. Deep-Link Routing

Deep-links use the canonical `gridcode://` scheme.

**Create offer:**

```
gridcode://trade-offer/create/<grid_id>/<shard_id>?role=TraderID
```

**Accept offer:**

```
gridcode://trade-offer/accept/<offer_id>?role=<TakerSubID>
```

Deep-link loads: offer metadata, price rate, expiry, fillable amounts. Workers validate SubID role and shard claim.

## 12. Receipt Structure

**ReceiptPreconfirm fields:**

```
offer_id
maker_subid
taker_subid
simulation_hash
```

**ReceiptConfirm fields:**

```
offer_id
final_status
payout_map_hash
timestamp
block_height
```

Receipts are used by: Reputation Vault, Public Market indexer, trade history module.

## 13. Compliance Summary

This contract is fully aligned with:

- Whitepaper v3.0 (Trade Market model)
- Technical Addendum v3.1 (multi-recipient TX and Worker-first validation)
- GCSPEC v1.1 (metadata boundaries and FSM)
- Runtime Architecture v1.1 (simulation parity and metadata discipline)
- Activation/GCU model (grid activation rules)
- Shard Rental Contract (tenant binding for TradeGrid)
- Marketplace Fee Table v1.0 (1% fee structure)
- Identity & Reputation Spec v1.2 (TraderID dynamics)

## 14. Diagrams

### 14.1 High-Level Trade Offer Flow

```
Trader (Maker) → Create Offer
  │
  ▼
Worker validates metadata
  │
  ▼
Offer enters ACTIVE state
  │
  ▼
Buyer (Taker) → Accept Offer
  │
  ▼
Phantom Mode Simulation
  │
  ▼
Taker Signs TX → TradeVault executes → Settlement
```

### 14.2 Trade Offer FSM

```
INIT → ACTIVE → PARTIAL → FILLED
          │        │
          └──▶ CANCELLED
          └──▶ EXPIRED
```

### 14.3 Metadata Structure

```
trade-offer-meta.ber
  offer_id
  grid_id
  shard_id
  trader_subid
  give_asset
  give_amount
  want_asset
  want_amount
  min_fill
  max_fill
  expiry_timestamp
  status           (0=ACTIVE, 1=PARTIAL, 2=FILLED, 3=CANCELLED, 4=EXPIRED)
  created_at
  last_updated

Mutable:   status, give_amount (partial), want_amount (partial), last_updated
Immutable: offer_id, trader_subid, give_asset, want_asset, grid_id, shard_id
```

### 14.4 Preconditions Check

```
Maker → Create Offer
  │
  ▼
Worker Preconditions:
  - Grid is ACTIVE
  - Shard is CLAIMED by trader_subid
  - Role = TraderID
  - give_amount > 0
  - want_amount > 0
  - rate > 0
  - metadata size <= max_metadata_size
  - RI >= minimum_trader_ri
  - No pending conflicting trades
  │
  ├── FAIL ──▶ Reject
  └── PASS ──▶ Phantom Mode Simulation
```

### 14.5 Phantom Mode Simulation Flow

```
Buyer selects offer
  │
  ▼
Phantom Simulation:
  - Check expiry
  - Validate maker/taker roles
  - Compute fill_amount
  - Check available balance
  - Compute fee fractions (1% total)
  - Build payout_map
  - Compute metadata_diff_hash
  - Determine final_state (ACTIVE | PARTIAL | FILLED)
  │
  ▼
Return simulation_result to UI
```

### 14.6 Vault Execution (TradeVault)

```
TradeVault
  │
  ├── 1. Lock buyer stake (escrow)
  ├── 2. Lock maker assets
  ├── 3. Transfer assets: maker → taker
  ├── 4. Transfer assets: taker → maker
  ├── 5. Deduct fees (1%): Sponsor 0.5% / Treasury 0.5%
  ├── 6. Multi-Recipient TX (atomic settlement)
  ├── 7. Update offer metadata (PARTIAL / FILLED)
  └── 8. Emit ReceiptPreconfirm → Commit → ReceiptConfirm
```

### 14.7 Multi-Recipient Settlement Structure

```
payout_map = [
  {maker_subid,   maker_receive_amount},
  {taker_subid,   taker_receive_amount},
  {sponsor_subid, sponsor_fee},
  {treasury,      treasury_fee}
]
```

Atomic Settlement — 1 TX:

| Recipient | Amount |
|---|---|
| Maker | Asset received from taker |
| Taker | Asset received from maker |
| Sponsor | 0.5% fee |
| Treasury | 0.5% fee |

### 14.8 Partial Fill Logic

```
Original Offer:
  give_amount = 100
  want_amount = 50

Taker fills 60%:
  settlement:      give=60, want=30
  remaining offer: give=40, want=20

ACTIVE → PARTIAL
```

Rate invariant MUST be maintained using cross-multiplication equality, not floating-point division:

```
original_give × remaining_want == original_want × remaining_give
```

All arithmetic MUST be integer-only. Rounding drift via repeated division is prohibited.

### 14.9 Deep-Link Routing

```
Create Offer:
  gridcode://trade-offer/create/<grid_id>/<shard_id>?role=TraderID

Accept Offer:
  gridcode://trade-offer/accept/<offer_id>?role=<TakerSubID>

Routing pipeline:
  Deep-Link → Worker resolves metadata → Phantom Mode →
  Wallet → TradeVault → ReceiptConfirm
```

### 14.10 Worker Enforcement

```
Worker Validations:
  - Nonce safety
  - No parallel fills on same offer
  - Shard tenant = maker_subid
  - Grid ACTIVE
  - Valid asset types
  - give/want invariants maintained
  - Expiry not exceeded
  - Simulation hash matches execution
  - Payout map integrity
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Execute
```

### 14.11 Security Model

| Threat | Defense |
|---|---|
| Front-running taker acceptances | Nonce and Worker lock |
| Double fills / race attacks | `offer_id` write lock |
| Maker or taker spoofing | SubID signature enforcement |
| Replay attack | `metadata_diff_hash` and receipts |
| Rate manipulation | Rate frozen during simulation |
| Expired offer execution | Worker expiry check |
| Invalid metadata injection | BER checksum enforcement |

### 14.12 Complete Trade Lifecycle

```
Maker → CREATE OFFER
  │
  ▼
ACTIVE OFFER
  │
  ▼ (buyer accepts)
Phantom Mode Simulation
  │
  ▼
TradeVault Executes
  │
  ├──▶ PARTIAL (remaining amount live) ──▶ (next fill or CANCELLED/EXPIRED)
  └──▶ FILLED  (no remaining amount)   ──▶ (archived)
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
- `/docs/contracts/shard-rental-contract-spec-v1.0.md`
- `/docs/economics/marketplace-fee-table-v1.0.md`
