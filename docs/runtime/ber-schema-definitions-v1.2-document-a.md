---
title: GridCoDe — BER Schema Definitions (Document A)
version: v1.2
status: Active Binding
domain: Runtime
layer: Metadata Schema — Core System Schemas
environment: Gridnet OS
authoritative: true
---

# GridCoDe — BER Schema Definitions (Document A)

Core System BER Schemas. This document defines the canonical BER schema structures for grid, shard, trust, governance, configuration, deep-link, and receipt metadata.

## 1. Conventions

### 1.1 Primitive Types

| Type | Definition |
|---|---|
| `u8` | Unsigned 8-bit integer |
| `u32` | Unsigned 32-bit integer |
| `u64` | Unsigned 64-bit integer |
| `u128` | Unsigned 128-bit integer |
| `i32` | Signed 32-bit integer |
| `bool` | Boolean |
| `bytes` | Arbitrary byte array |
| `string` | UTF-8 text |
| `hash32` | 32-byte hash |
| `id` | `u64` ID reference |

### 1.2 General Metadata Rules

All metadata files MUST include:

- `version`
- `checksum`
- `last_updated`

Workers MUST validate:

- BER structure
- Schema version
- Checksum correctness

Vaults MUST NOT modify fields outside allowed transitions.

## 2. grid-meta.ber

### 2.1 Formal Schema

```
GridMeta:
  version:            u8
  checksum:           u128
  grid_id:            id
  grid_type:          u8   # 0=Store, 1=Service, 2=Challenge, 3=Trade,
                           #  4=Lending, 5=Insurance, 6=Activation
  sponsor_subid:      id
  size:               u8   # NxN grid (N = 1, 2, 10, etc.)
  expiry_timestamp:   u64
  active:             bool
  shard_ids:          [id] # dynamic array
  reward_model:
    sponsor_rate:     u32  # basis points (0–10000)
    treasury_rate:    u32
    vault_rate:       u32
  created_at:         u64
  last_updated:       u64
```

### 2.2 Explanation

`grid-meta.ber` defines the grid itself:

- Who owns/operates it (SponsorID)
- Grid category (Store, Service, Challenge, etc.)
- Shard membership
- Reward distribution rules
- Whether the grid is still active or expired

Workers load this file to:

- Determine which Vault type applies to shards
- Validate deep-link routing
- Build marketplace indexing

Vaults touch only `reward_model` or `expiry_timestamp` during activation cycles. All other fields MUST remain immutable.

## 3. shard-meta.ber

### 3.1 Formal Schema

```
ShardMeta:
  version:        u8
  checksum:       u128
  shard_id:       id
  grid_id:        id
  tenant_subid:   id   # SubID occupying the shard
  state:          u8   # 0=Vacant, 1=Claimed, 2=Locked, 3=Expired
  created_at:     u64
  last_updated:   u64
```

### 3.2 Explanation

Represents a single shard inside any grid.

Workers use it to determine:

- Who can act on listings/tasks under that shard
- Which SubID owns/controls the shard
- Whether the shard is operational

Vaults update `state` based on:

- Activation
- Expiration
- Tenant departure

All other fields MUST remain immutable.

## 4. trustbond.ber

### 4.1 Formal Schema

```
TrustBond:
  version:                u8
  checksum:               u128
  owner_subid:            id
  bonded_amount:          u64    # in GNC
  slashed_amount_total:   u64
  last_slash_hash:        hash32
  last_slash_timestamp:   u64
  reputation_delta:       i32    # net reputation effect
  last_updated:           u64
```

### 4.2 Explanation

`trustbond.ber` stores:

- How much GNC is bonded
- How much has been slashed
- The last slashing event (for reputation and dispute audits)

Vaults use this metadata for:

- Service disputes
- Challenge fraud detection
- Lending trust scoring
- Insurance claim validity

Workers load it to compute:

- Slashing eligibility
- Dispute outcomes
- Permission levels

This schema is essential for reputation integrity.

## 5. governance-meta.ber

### 5.1 Formal Schema

```
GovernanceMeta:
  version:            u8
  checksum:           u128
  proposal_id:        id
  state:              u8   # 0=Draft, 1=Active, 2=Passed, 3=Failed, 4=Executed
  proposer_subid:     id
  category:           u8   # economic, treasury, category mgmt, configuration, etc.
  payload:            bytes  # encoded governance action
  stake_required:     u64
  stake_locked:       u64
  votes_for:          u128
  votes_against:      u128
  role_coefficients:
    sponsor:          u16
    trader:           u16
    seller:           u16
    provider:         u16
    lender:           u16
    borrower:         u16
    participant:      u16
  ends_at:            u64  # voting period end
  last_updated:       u64
```

### 5.2 Explanation

`governance-meta.ber` provides all data needed for:

- Proposal creation
- Voting
- Execution
- Stake locking
- Quorum calculation

Workers:

- Calculate voting power
- Enforce role coefficients
- Provide deterministic proposal summaries

GovernanceVault:

- Updates `state`
- Updates `votes_for` and `votes_against`
- Finalizes payload execution

No field outside the FSM-permitted set is mutable.

## 6. global-config.ber

### 6.1 Formal Schema

```
GlobalConfig:
  version:             u8
  checksum:            u128
  min_job_price:       u64
  dispute_timeout:     u32
  max_metadata_size:   u32
  schema_versions:
    grid:              u8
    shard:             u8
    listing:           u8
    service:           u8
    challenge:         u8
    trade_offer:       u8
    loan:              u8
    insurance:         u8
    governance:        u8
  created_at:          u64
  last_updated:        u64
```

### 6.2 Explanation

This is the master configuration file for GridCoDe, referenced in:

- Phantom Mode
- Worker metadata validators
- Vault safety checks

`min_job_price` supports fee-aware economics. `schema_versions` allows future upgrades without breaking compatibility.

Only GovernanceVault MAY update this file.

## 7. deep-link-manifest.ber

### 7.1 Formal Schema

```
DeepLinkManifest:
  version:              u8
  checksum:             u128
  allowed_targets:      [string]  # e.g. ["store","service","challenge","trade","grid"]
  allowed_params:       [string]  # e.g. ["action","subid","return_url"]
  max_param_length:     u16
  security_flags:
    allow_localhost:    bool
    block_external_hosts: bool
  last_updated:         u64
```

### 7.2 Explanation

Defines:

- Which deep-link targets exist
- Which parameters are permitted
- Security restrictions

This metadata is used by:

- The Deep-Link Router
- Mobile OS integration
- External app bridging

Necessary for safe interoperability.

## 8. receipt-preconfirm.ber

### 8.1 Formal Schema

```
ReceiptPreconfirm:
  version:                   u8
  checksum:                  u128
  tx_hash:                   hash32
  sender_subid:              id
  vault_type:                u8
  action:                    string
  timestamp:                 u64
  effective_nonce:           u64
  simulation_result_hash:    hash32
  metadata_snapshot_hash:    hash32
  last_updated:              u64
```

### 8.2 Explanation

Generated as soon as a transaction enters mempool and pending state begins.

Used for:

- Evidence in Service disputes
- PDF receipts
- UI pending display

Workers use it to maintain continuity while awaiting confirmation.

## 9. receipt-confirm.ber

### 9.1 Formal Schema

```
ReceiptConfirm:
  version:            u8
  checksum:           u128
  tx_hash:            hash32
  block_height:       u64
  confirmations:      u32
  final_state_hash:   hash32
  vault_transition:   string  # name of state transition
  outputs:            [(subid: id, amount: u64)]
  timestamp:          u64
  last_updated:       u64
```

### 9.2 Explanation

This is the final confirmed receipt, containing:

- Vault transition name
- Final output values
- Multi-recipient payout summary
- Block confirmation details
- State change digest

Required for:

- Dispute proofs
- Treasury accounting
- User confirmations
- Reputation assignment

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** v1.1
**Requires:**
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
