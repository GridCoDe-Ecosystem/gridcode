---
title: GridCoDe — Grid Activation Contract Specification
version: v1.0
status: Active Binding
domain: Contracts
layer: Contract Specification — ActivationVault
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Grid Activation Contract Specification

## 1. Purpose

The Grid Activation Contract is the mechanism by which a Sponsor activates a GridNFT for an epoch. Activation:

- Unlocks all shards
- Enables Store, Service, Trade, Challenge, and Lending markets
- Registers the grid in the active economy
- Assigns Treasury seed (`S_gc`)
- Locks Sponsor stake (`S_sp`)
- Sets the epoch timer
- Enables shard tenants to claim slots
- Initializes yield distribution state

Grid activation is the foundation of GridCoDe's synthetic staking model.

## 2. Constraints

### 2.1 Runtime v3.1 Constraints

- Activation is whole-grid only — per-shard activation is prohibited
- Activation MUST be deterministic and validated in Phantom Mode
- All metadata changes MUST be Worker-approved
- No activation MAY occur while the grid is in mid-epoch finalization
- Multi-TX activation is forbidden — only one signing TX is allowed
- All stake locks and metadata writes MUST be atomic

### 2.2 GCU Model Constraints

- Treasury seed (`S_gc`) is added by protocol, not Sponsor
- Sponsor stakes `S_sp`, which is returnable but non-yielding
- Activation is epoch-bound

### 2.3 GCSPEC Constraints

- All state changes MUST occur inside the Vault FSM
- `ReceiptPreconfirm` and `ReceiptConfirm` MUST reflect all state transitions

## 3. Metadata I/O

Activation modifies two metadata structures.

### 3.1 grid-meta.ber — Updated Fields

```
grid-meta.active            = true
grid-meta.expiry_timestamp  = epoch_end
grid-meta.sponsor_subid     = sponsor_subid
```

### 3.2 grid-meta.ber — Immutable Fields

- `grid_id`
- `grid_type`
- `reward_model`
- `shard_ids`

### 3.3 activation-meta.ber — New Record Created on Activation

```
activation-meta:
  version
  checksum
  grid_id
  sponsor_subid
  epoch_start
  epoch_end
  s_sp_locked
  s_gc_seeded
  status          # 0=Pending, 1=Active, 2=Finalizing, 3=Expired
```

`ACTIVATING` is an ephemeral Vault transition state and is not persisted in `activation-meta.status`. It exists only within the execution block between the Sponsor's TX submission and successful commit. Once committed, `activation-meta.status` advances directly to `Active` (1).

Workers MUST guarantee: checksum correctness, immutability of forbidden fields, and deterministic timestamps.

## 4. Contract FSM (Activation Lifecycle)

```
INIT → ACTIVATING → ACTIVE → FINALIZING → EXPIRED
                                │
                                └──▶ (reactivate) → ACTIVATING
```

### 4.1 Transition Table

| From | Action | To | Triggered By | Worker Validations |
|---|---|---|---|---|
| `INIT` | `activate` | `ACTIVATING` | Sponsor | RI threshold, stake, seed availability |
| `ACTIVATING` | `lock_stakes` | `ACTIVE` | Vault | Checksum, balance lock |
| `ACTIVE` | `finalize_epoch` | `FINALIZING` | Vault | Epoch timer reached |
| `FINALIZING` | `distribute_yield` | `EXPIRED` | Vault | Payout map generation, multi-output TX |
| `EXPIRED` | `reactivate` | `ACTIVATING` | Sponsor | Same as initial activation |

## 5. Activation Preconditions

Workers MUST enforce the following before Phantom Mode:

1. Sponsor SubID exists and matches `grid-meta.sponsor_subid`
2. Sponsor RI ≥ `minimum_sponsor_RI`
3. Grid is NOT in `ACTIVE` or `FINALIZING` state
4. Activation slot (from ActivationBatch) is available
5. Sponsor has sufficient stake `S_sp`
6. Treasury has an available seed `S_gc` for the slot
7. No pending activation for the same grid

If any check fails, Workers MUST reject before simulation.

## 6. Phantom Mode Simulation

Phantom Mode MUST simulate:

- Stake lock for Sponsor
- Seed assignment
- `epoch_start` and `epoch_end` MUST be derived from deterministic on-chain timestamp injection. `epoch_start` is the block timestamp at activation commit; `epoch_end` is `epoch_start + duration`, where `duration` is sourced exclusively from `GlobalConfig`. No external clock MAY be used.
- Yield computation inputs MUST be derived solely from on-chain activity logs for the epoch. No off-chain data, sponsor override, or DAO adjustment MAY influence yield during finalization.
- Updated `grid-meta` and `activation-meta`
- Shard claimability flag
- Sponsor and Treasury future weight share
- Expected yield distribution preview
- All failure modes

Simulation output:

```
simulation_result:
  new_state:         ACTIVE
  epoch_end:         t + duration
  s_sp:              sponsor_stake
  s_gc:              treasury_seed
  weight_projection: { sponsor_weight, tenant_weight: 0 }
  metadata_diff_hash
```

Workers MUST enforce parity between simulation and execution.

## 7. Vault Execution

Steps performed by ActivationVault:

Stake locks (`S_sp`, `S_gc`), all metadata writes (`grid-meta`, `activation-meta`), and shard claimability updates MUST all occur within the same atomic Vault execution block. No partial commit is permitted.

1. Lock Sponsor stake (`S_sp`)
2. Lock Treasury seed (`S_gc`)
3. Update metadata:
   - `grid-meta.active = true`
   - `grid-meta.expiry_timestamp = epoch_end`
   - `activation-meta.status = ACTIVE`
4. Emit `ReceiptPreconfirm`
5. Commit state in one TX
6. Emit `ReceiptConfirm`

No fields in `grid-meta` other than those listed in Section 3.1 MAY be changed by this contract.

## 8. Shard Claimability

Once activation enters `ACTIVE`:

```
shard-meta.state = VACANT   (for all shards in the grid)
```

Tenants MAY now stake `S_p`, claim a shard, and begin Store, Service, Trade, Challenge, or Lending activity. This is consistent with GridNFT Standards and the Shard Rental Contract.

## 9. Expiry & Finalization

At `epoch_end`:

1. Vault transitions to `FINALIZING`
2. Worker aggregates all activity for the epoch
3. Worker computes weights and yield `(Y)`
4. YieldDistributor generates payout map
5. Vault executes multi-recipient payout TX
6. Vault sets `activation-meta.status = EXPIRED`
7. Vault sets `grid-meta.active = false`
8. Principals (`S_sp`, `S_p`, `S_gc`) are released

Grid returns to inactive state until next activation. `grid-meta.active = false` MUST be written in the same atomic finalization TX as principal release, ensuring no window where a grid is EXPIRED but still appears active.

## 10. Deep-Link Routing

Deep-links use the canonical `gridcode://` scheme.

**Activate grid:**

```
gridcode://grid-activate/<grid_id>?role=SponsorID
```

Workers MUST validate: correct SubID role, sufficient stake, RI threshold, no pending activation.

Used by: UI Activation Page, external app integrations, governance apps for sponsor monitoring.

## 11. Worker Validation Rules

Workers MUST verify:

**On activation request:**

- SubID == `sponsor_subid`
- RI ≥ `minimum_sponsor_RI`
- Stake availability
- Slot availability
- Treasury seed availability
- Metadata schema version matches `GlobalConfig`
- Grid not in `ACTIVE` or `FINALIZING`

**On commit:**

- `metadata_diff_hash` matches simulation
- `grid-meta` checksum correct
- `activation-meta` checksum correct

**On expiry:**

- Yield computed deterministically
- Payout map equals simulation map

If any mismatch → fail-safe rollback.

## 12. Security Model

| Threat | Defense |
|---|---|
| Double activation attempts | Vault state flags (`ACTIVE`/`FINALIZING`) |
| Sponsor impersonation | SubID signature and Worker role check |
| Metadata corruption | Worker BER checksum validation |
| Epoch skipping | Deterministic epoch timer enforcement |
| Yield manipulation | Worker-computed weights, simulation parity |
| Replay attacks | Receipt hashes and nonce control |
| Race conditions around expiry | Single-TX atomic activation |

Security mechanisms: Worker-controlled metadata access, checksum enforcement, Phantom Mode simulation matching, atomic stake lock and metadata update, single-TX execution, final receipt confirmation.

## 13. Receipt Structure

**receipt-preconfirm.ber fields:**

```
grid_id
sponsor_subid
epoch_start
epoch_end
simulation_hash
nonce
timestamp
```

**receipt-confirm.ber fields:**

```
grid_id
epoch_end
final_state_hash
payout_map_hash
block_height
timestamp
```

## 14. Compliance Check

This contract is fully compliant with:

- Whitepaper v3.0 (activation model and synthetic staking)
- Technical Addendum v3.1 (single multi-output TX, Worker-first validation, metadata immutability, Phantom Mode simulation parity)
- GCSPEC v1.1 (FSM, metadata boundaries, transactional execution)
- Activation/GCU Framework (exact alignment with GCU model)
- Landlord–Tenant Yield Model (correct weight initialization)
- Marketplace Fee Table v1.0 (activation has no marketplace fee)
- Runtime Architecture v1.1 (all invariants enforced)

## 15. Diagrams

### 15.1 High-Level Activation Flow

```
Sponsor Initiates Activation
  │
  ▼
Worker Loads grid-meta & RI
  │
  ▼
Phantom Mode Simulation:
  - Stakes
  - Epoch timing
  - Eligibility
  - metadata_diff_hash
  │
  ▼
Sponsor Signs TX
  │
  ▼
ActivationVault Executes
  │
  ▼
Grid Becomes ACTIVE
  │
  ▼
Shards now claimable
```

### 15.2 Activation FSM

```
INIT
  │  activate
  ▼
ACTIVATING
  │  lock_stakes
  ▼
ACTIVE
  │  finalize_epoch
  ▼
FINALIZING
  │  distribute_yield
  ▼
EXPIRED ──▶ (reactivate) ──▶ ACTIVATING
```

### 15.3 Metadata Touchpoints

```
grid-meta.ber
  grid_id
  grid_type
  sponsor_subid     ← updated on activation
  active            ← updated on activation
  expiry_timestamp  ← updated on activation
  reward_model
  shard_ids[]

activation-meta.ber
  grid_id
  sponsor_subid
  epoch_start
  epoch_end
  s_sp_locked
  s_gc_seeded
  status

Workers ensure only allowed fields are modified.
```

### 15.4 Activation Preconditions Flow

```
Sponsor → Activate Grid
  │
  ▼
Worker Preconditions Check:
  - SponsorID match
  - Reputation threshold
  - Stake available
  - Treasury seed available
  - Grid not ACTIVE or FINALIZING
  - No pending activation
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Phantom Mode Simulation
```

### 15.5 Phantom Mode Simulation Pipeline

```
Phantom Simulation:
  - Lock (virtual) S_sp
  - Assign S_gc
  - Compute epoch_start
  - Compute epoch_end
  - Update grid-meta (virtual)
  - Produce metadata_diff_hash
  - Preview yield projection
  │
  ▼
Return simulation results to frontend

Simulation MUST match final execution.
```

### 15.6 Vault Execution

```
ActivationVault FSM
  │
  ├── 1. Lock Sponsor Stake (S_sp)
  ├── 2. Lock Treasury Seed (S_gc)
  ├── 3. Metadata update:
  │       grid-meta.active = true
  │       grid-meta.expiry_timestamp = epoch_end
  │       activation-meta.status = ACTIVE
  ├── 4. Emit ReceiptPreconfirm
  ├── 5. Commit Transaction
  └── 6. Emit ReceiptConfirm
```

### 15.7 Shard Claimability Unlock

```
Activation → ACTIVE
  │
  ▼
Shards become claimable

for each shard:
  shard-meta.state = VACANT

Tenants may now stake S_p and claim.
```

### 15.8 Epoch End → Finalization → Expiry

```
Epoch End (t = epoch_end)
  │
  ▼
FINALIZING
  │
  ▼
Worker Aggregates Activity
  │
  ▼
Worker Computes Weights & Y
  │
  ▼
YieldDistributor creates payout_map
  │
  ▼
ActivationVault executes ONE multi-recipient TX
  │
  ▼
Principals unlocked (S_sp, S_p, S_gc)
  │
  ▼
EXPIRED
```

### 15.9 Multi-Recipient Yield Distribution

```
payout_map = [
  {subid: sponsor,  amount: share_sp},
  {subid: tenant_1, amount: share_p1},
  {subid: tenant_2, amount: share_p2},
  ...
  {subid: treasury, amount: share_gc}
]
```

Final Yield Distribution — 1 Atomic TX:

| Recipient | Amount |
|---|---|
| Sponsor | `share_sp` |
| Tenant 1..N | `share_p1..pN` |
| Treasury | `share_gc` |

### 15.10 Deep-Link Routing

```
gridcode://grid-activate/<grid_id>?role=SponsorID
  │
  ▼
Worker validates SubID + permissions
  │
  ▼
Phantom Mode Simulation → Wallet → TX → ActivationVault
```

### 15.11 Worker Enforcement

```
Worker Enforcement During Activation:
  - Metadata immutability
  - Checksum enforcement
  - Stake validation (S_sp, S_gc)
  - RI threshold
  - Slot availability
  - Simulation parity check
  │
  ├── FAIL ──▶ Reject with error
  └── PASS ──▶ Vault Execution
```

### 15.12 Security Model Summary

```
THREAT                      DEFENSE
Double activation        →  Vault state flags (ACTIVE / FINALIZING)
Sponsor spoofing         →  SubID signature + Worker role check
Replay attack            →  Receipt hashes + nonce control
Metadata corruption      →  Worker BER checksum validation
Race conditions          →  Single-TX atomic activation
```

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/runtime/ber-schema-definitions-v1.2-document-a.md`
- `/docs/economics/economics-incentive-model-v1.1.md`
- `/docs/nft/gridnft-standards-v1.3.md`
