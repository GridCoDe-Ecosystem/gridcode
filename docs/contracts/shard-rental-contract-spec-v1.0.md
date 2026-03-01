---
title: GridCoDe — Shard Rental Contract Specification
version: v1.0
status: Active Binding
domain: Contracts
layer: Contract Specification — ShardRentalVault
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Shard Rental Contract Specification

## 1. Purpose

The Shard Rental Contract enables a participant to:

- Claim an available shard in an active grid
- Lock their Participant GCU stake (`S_p`)
- Acquire Tenant rights
- Register their SubID as tenant in the shard metadata
- Begin participating in Store, Service, Trade, Challenge, or Lending markets for that grid

Shard rental is the tenant onboarding mechanism for GridCoDe markets. It sits between Grid Activation (supply side) and all market activity contracts (demand side), and is the structural anchor of the Landlord–Tenant yield model. It is epoch-bound — tenants participate only for the duration of the activation epoch.

## 2. Preconditions

Before a tenant can claim a shard, Workers MUST enforce:

1. **Grid MUST be `ACTIVE`** — `grid-meta.active == true`
2. **Shard state MUST be `VACANT`** — `shard-meta.state == 0`
3. **Tenant SubID MUST have the correct role for the grid type:**
   - `SellerID` for StoreGrid
   - `ProviderID` for ServiceGrid
   - `TraderID` for TradeGrid
   - `CreatorID` for ChallengeGrid (shard host only; ParticipantID does not hold tenancy, lock stake, or register weight)
   - `BorrowerID` or `LenderID` for LendingGrid (depending on grid type)
4. **Tenant RI MUST meet minimum threshold** — prevents low-trust SubID abuse
5. **Tenant MUST have sufficient stake `S_p`** — configured per grid type in `GlobalConfig`
6. **No pending shard claim TX for that SubID** — enforced via nonce ordering

If any condition fails, Workers MUST reject before Phantom Mode.

## 3. Metadata Structure (BER)

### 3.1 Formal Schema — shard-meta.ber

```
ShardMeta:
  shard_id:      u64
  grid_id:       u64
  tenant_subid:  u64
  state:         u8   # 0=VACANT, 1=CLAIMED, 2=LOCKED, 3=EXPIRED
  created_at:    u64
  last_updated:  u64
```

### 3.2 Allowed Mutations

| Field | Change | Condition |
|---|---|---|
| `tenant_subid` | Set to claimant's SubID | On claim |
| `state` | `VACANT → CLAIMED` | On claim |
| `state` | `CLAIMED → LOCKED` | During exclusive Vault operations |
| `state` | `CLAIMED/LOCKED → EXPIRED` | At epoch end |
| `last_updated` | Current block timestamp | Any write |

### 3.3 Forbidden Mutations

The following fields MUST remain immutable for the life of the shard:

- `shard_id`
- `grid_id`
- `created_at`

Workers MUST NOT permit modification of any other shard's metadata. Workers MUST NOT permit modification of `grid-meta` through this contract.

### 3.4 Cross-Epoch Tenant Reset

Upon transition to `EXPIRED`, `tenant_subid` MUST be reset to `0` (null) within the same atomic expiry TX. This prevents cross-epoch tenancy confusion — a new tenant claiming the shard in the next epoch MUST be writing to a clean record, not inheriting a prior tenant's SubID.

## 4. Contract FSM (Shard Lifecycle)

```
VACANT → CLAIMED → LOCKED → EXPIRED → VACANT (next epoch)
            │
            └──▶ EXPIRED (direct, at epoch end if not locked)
```

| State | Value | Meaning |
|---|---|---|
| `VACANT` | 0 | Shard unoccupied, open for rental |
| `CLAIMED` | 1 | Tenant has staked `S_p` and holds occupancy |
| `LOCKED` | 2 | Shard in exclusive use during a Vault operation |
| `EXPIRED` | 3 | Epoch ended; stake released; shard resets to VACANT next epoch |

`LOCKED` is a transient state. A shard MUST return to `CLAIMED` after the Vault operation that locked it completes. The `LOCKED` state MUST NOT persist beyond a single Vault execution block.

## 5. Phantom Mode Simulation

Before signing, Phantom Mode MUST simulate:

- Stake lock (`S_p_i`)
- Updated `shard-meta`
- Updated tenant weight contribution (for yield projections)
- Eligibility status
- Expected ROI for tenant (optional, non-binding)
- `metadata_diff_hash`
- All failure modes (stake shortage, low RI, shard no longer VACANT)

Simulation output:

```
simulation_result:
  shard_id
  claimant_subid
  new_state:        CLAIMED
  s_p_locked
  weight_increment
  metadata_diff_hash
  epoch_end
```

Workers MUST enforce simulation parity with final execution. If the shard transitions from `VACANT` to any other state between simulation and commit, the Vault MUST reject the TX.

## 6. Vault Execution

Shard rental is executed by ShardRentalVault (or the embedded rental function inside ActivationVault where applicable).

Stake lock (`S_p`), shard-meta write, and weight registration MUST all occur within the same atomic Vault execution block. No partial commit is permitted.

Execution steps:

1. Revalidate `shard-meta.state == VACANT` immediately before commit (prevents race between simulation and execution)
2. Lock tenant stake (`S_p`)
3. Update `shard-meta`:
   - `tenant_subid = claimant_subid`
   - `state = CLAIMED`
   - `last_updated = block_timestamp`
4. Register tenant weight contribution with YieldDistributor. Weight contribution timing, proration rules, and snapshot behaviour are defined exclusively in Landlord–Tenant Yield Model v1.0 and MUST be deterministic. This contract registers the `S_p` lock value; all downstream weight computation is delegated to that model.
5. Emit `ReceiptPreconfirm`
6. Commit state change
7. Emit `ReceiptConfirm`

No tokens are transferred to any other party. This is a pure stake-lock and metadata-registration contract.

## 7. Fee Model

Shard rental incurs no marketplace fee because it is not a sale, has no value transfer, and is a stake-lock operation. The only cost is the Gridnet OS execution fee for the TX itself. This is consistent with the Marketplace Fee Table and Economics v1.1.

## 8. Integration With Market Vaults

Once shard rental completes, the tenant's `shard-meta.state = CLAIMED` entry is the access credential checked by all downstream vaults:

| Grid Type | Market Access Unlocked |
|---|---|
| StoreGrid | Tenant may create product listings (StoreListingVault) |
| ServiceGrid | Tenant may accept service tasks (ServiceVault) |
| TradeGrid | Tenant may create trade offers (TradeVault) |
| ChallengeGrid | Tenant may create or host challenges (ChallengeVault) — `CreatorID` only |
| LendingGrid | Tenant may initiate lending or borrowing (LendingVault) |

Every downstream vault MUST verify `shard-meta.state == CLAIMED` and `shard-meta.tenant_subid == requesting_subid` before proceeding. Shard rental is market access permission.

## 9. Expiry & Epoch-End Handling

At `epoch_end`, ActivationVault transitions to `FINALIZING → EXPIRED`. The following MUST occur within the same atomic finalization TX as `grid-meta.active = false`:

1. `shard-meta.state = EXPIRED` for all shards in the grid
2. `shard-meta.tenant_subid = 0` (reset for next epoch)
3. Tenant stakes (`S_p`) unlocked and returned

No stake unlock race is possible because the entire expiry sequence is atomic. Tenants MAY re-claim shards in the next activation epoch from a clean VACANT state.

## 10. Deep-Link Routing

Deep-links use the canonical `gridcode://` scheme.

**Claim shard:**

```
gridcode://shard-rent/<grid_id>/<shard_id>?role=<SubID_role>
```

Workers MUST verify: correct SubID role for grid type, tenant eligibility, shard availability.

UI renders: shard vacancy info, activation epoch timer, required `S_p` stake amount, Phantom Mode preview.

## 11. Worker Validation Rules

Workers MUST enforce:

**Before Simulation:**

- `shard-meta.state == VACANT`
- `grid-meta.active == true`
- SubID role matches grid type
- RI ≥ minimum threshold
- No pending TX involving same tenant and same shard
- Sufficient `S_p` stake available
- Metadata is schema-valid

**Before Execution (commit-time revalidation):**

- `metadata_diff_hash` matches simulation
- `shard-meta.state` is still `VACANT` (re-check, not cached from simulation)
- Stake-lock parameters match simulation
- No mid-epoch status changes that would invalidate the rental

The commit-time shard state recheck is the primary defense against parallel rental exploit. It MUST be performed unconditionally on every commit regardless of simulation result age.

## 12. Security Model

| Threat | Defense |
|---|---|
| Double-claim race | Worker locks shard on simulation start; commit-time state recheck |
| Parallel rental exploit | Commit-time `state == VACANT` revalidation; atomic write |
| Stake unlock race | Expiry sequence is fully atomic with `grid-meta.active = false` |
| Weight distortion | `S_p` weight registration is part of the same atomic claim TX |
| Cross-epoch tenancy confusion | `tenant_subid` reset to `0` on expiry in same atomic TX |
| Sponsor–tenant payout mismatch | Weight contribution registered deterministically at claim time |
| Low-RI Sybil abuse | RI threshold and TrustBond enforcement |
| Impersonation | SubID signature validation |
| Metadata corruption | Worker checksum enforcement |
| Replay attack | Nonce and receipt hash protection |
| Expired grid claiming | `grid-meta.active` revalidated before claim |
| Stale metadata exploit | Checksum and schema version enforcement |

## 13. Receipt Structure

**receipt-preconfirm.ber fields:**

```
grid_id
shard_id
tenant_subid
simulation_hash
effective_nonce
timestamp
```

**receipt-confirm.ber fields:**

```
grid_id
shard_id
tenant_subid
state:         CLAIMED
block_height
timestamp
```

Receipts support: dispute resolution, audit trails, UI sync, yield weight verification.

## 14. Compliance Check

This contract is fully compliant with:

- Whitepaper v3.0
- Technical Addendum v3.1
- Activation/GCU Framework v1.0
- Landlord–Tenant Yield Model v1.0
- Marketplace Fee Table v1.0
- Identity & Reputation Spec v1.2
- GridNFT Standards v1.3
- GCSPEC v1.1
- Runtime Execution Architecture v1.1
- Worker-only metadata modification rules

## 15. Diagrams

### 15.1 High-Level Shard Rental Flow

```
Tenant (SubID) → Select Shard
  │
  ▼
Worker Validates Conditions
  │
  ▼
Phantom Mode Simulation:
  - Stake S_p (virtual)
  - Check RI
  - Shard state preview
  - metadata_diff_hash
  │
  ▼
Tenant Signs TX
  │
  ▼
ShardRentalVault Executes
  │
  ▼
Shard State → CLAIMED
```

### 15.2 Shard Rental FSM

```
VACANT (0) → CLAIMED (1) → LOCKED (2) → EXPIRED (3)
                │                            │
                └─────────────────────────────┘
                       (direct at epoch end)

EXPIRED → VACANT (0)   (next epoch, after tenant_subid reset)
```

### 15.3 Metadata Touchpoints

```
shard-meta.ber
  shard_id                    ← immutable
  grid_id                     ← immutable
  tenant_subid                ← updated on claim; reset to 0 on EXPIRED
  state                       ← updated on each FSM transition
  created_at                  ← immutable
  last_updated                ← updated on every write

Only allowed fields may change. Everything else is immutable.
```

### 15.4 Preconditions Flow

```
Tenant → "Claim Shard"
  │
  ▼
Worker Preconditions Check:
  - grid-meta.active == true
  - shard-meta.state == VACANT
  - SubID role matches grid type
  - RI >= minimum threshold
  - Sufficient S_p stake
  - No pending claim for same SubID on same shard
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Phantom Mode Simulation
```

### 15.5 Phantom Mode Simulation Flow

```
Phantom Mode (Preview):
  - Lock S_p (virtual)
  - Validate eligibility
  - Compute weight contribution (yield model)
  - Produce metadata_diff_hash
  - Produce simulation execution hash
  │
  ▼
Return simulation_result to UI

Simulation MUST match final Vault execution.
```

### 15.6 Vault Execution (ShardRentalVault)

```
ShardRentalVault Execution:
  │
  ├── 0. Revalidate shard-meta.state == VACANT  ← commit-time check
  ├── 1. Lock Tenant Stake (S_p)
  ├── 2. Update shard-meta:
  │       tenant_subid = claimant
  │       state        = CLAIMED
  │       last_updated = block_timestamp
  ├── 3. Register weight contribution with YieldDistributor
  ├── 4. Emit ReceiptPreconfirm
  ├── 5. Commit metadata update (atomic)
  └── 6. Emit ReceiptConfirm

Steps 0–5 are one atomic block. No partial commit permitted.
```

### 15.7 Worker Enforcement Pipeline

```
Worker Enforcement Layer:
  - Schema check
  - Checksum validation
  - SubID → Role check
  - RI validation
  - Stake availability
  - Grid ACTIVE state
  - Shard VACANT state (simulation time)
  - Simulation parity
  - Shard VACANT state (commit time — unconditional recheck)
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Vault Execution
```

### 15.8 Shard State at Activation

```
Grid Activation → ACTIVE
  │
  ▼
All shards set: shard-meta.state = VACANT

Tenants may now claim their shard.
```

### 15.9 Shard State at Epoch End

```
Grid Epoch End (atomic finalization TX)
  │
  ├── grid-meta.active = false
  ├── shard-meta.state = EXPIRED     (all shards)
  ├── shard-meta.tenant_subid = 0    (all shards — cross-epoch reset)
  └── S_p unlocked → returned to tenant

No stake unlock race: entire sequence is one atomic TX.
Next epoch: shards return to VACANT for new claims.
```

### 15.10 Multi-Vault Integration

```
Shard Rental Completed (state = CLAIMED)
  │
  ▼
Downstream vault checks: shard-meta.state == CLAIMED
                          shard-meta.tenant_subid == requesting_subid
  │
  ├── StoreGrid    ──▶ StoreListingVault  (Tenant → Seller)
  ├── ServiceGrid  ──▶ ServiceVault       (Tenant → Provider)
  ├── TradeGrid    ──▶ TradeVault         (Tenant → Trader)
  ├── ChallengeGrid──▶ ChallengeVault     (Tenant → Host)
  └── LendingGrid  ──▶ LendingVault       (Tenant → Borrower/Lender)

Shard rental = market access credential.
```

### 15.11 Deep-Link Routing

```
gridcode://shard-rent/<grid_id>/<shard_id>?role=<SubID_role>
  │
  ▼
Worker resolves role + shard availability
  │
  ▼
UI → Phantom → TX → ShardRentalVault
```

### 15.12 Security Threats & Defenses

```
THREAT                          DEFENSE
Double-claim race            →  Worker sim-lock + commit-time recheck
Parallel rental exploit      →  Atomic write + commit-time revalidation
Stake unlock race            →  Expiry TX is atomic with grid-meta reset
Weight distortion            →  Weight registered in same claim TX
Cross-epoch tenancy          →  tenant_subid reset to 0 at EXPIRED
Payout mismatch              →  S_p weight registration deterministic
Low-RI Sybil attack          →  RI threshold enforcement
Replay attack                →  Nonce + receipt hash protection
Unauthorized claims          →  SubID role validation
Stale metadata               →  Checksum + version enforcement
```

### 15.13 Full Shard Rental Lifecycle

```
[Grid ACTIVE] → All shards VACANT
  │
  ▼
Tenant selects shard
  │
  ▼
Worker validation (pre-simulation)
  │
  ▼
Phantom Mode simulation
  │
  ▼
Tenant signs TX
  │
  ▼
ShardRentalVault: revalidate → lock S_p → update meta → register weight
  │
  ▼
shard.state = CLAIMED

Tenant operates market role (Store / Service / Trade / Challenge / Lending)

  │
  ▼
Epoch End (atomic finalization)
  │
  ├── shard.state = EXPIRED
  ├── tenant_subid = 0
  └── S_p unlocked
  │
  ▼
Next epoch → shard.state = VACANT → available for new claim
```

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/contracts/grid-activation-contract-spec-v1.0.md`
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/runtime/ber-schema-definitions-v1.2-document-a.md`
- `/docs/economics/economics-incentive-model-v1.1.md`
- `/docs/nft/gridnft-standards-v1.3.md`
