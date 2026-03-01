---
title: GridCoDe — Challenge Creation Contract Specification
version: v1.0
status: Active Binding
domain: Contracts
layer: Contract Specification — ChallengeVault
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Challenge Creation Contract Specification

## 1. Purpose

The Challenge Creation Contract enables a participant (Sponsor, Brand, DAO, or GridStarter) to:

- Create a Challenge inside a ChallengeGridNFT
- Define reward pools (GNC, GridNFTs, Reputation boosts)
- Specify task requirements
- Set participant limits
- Set challenge duration
- Allow users to join through ChallengeVault
- Allow Workers to validate task completions
- Distribute rewards securely and deterministically

Challenges appear in Private Marketplaces, the global Public Market Challenges section, and as decentralized on-chain missions for the community.

## 2. Preconditions

Before a Challenge can be created, Workers MUST enforce:

**Grid**

- Grid MUST be `ACTIVE`
- Grid type MUST be `ChallengeGrid`
- Shard MUST be `CLAIMED` by creator SubID

**Creator**

- SubID role MUST be one of: `SponsorID`, `CreatorID`, `ProviderID` (for contribution challenges)
- RI MUST be ≥ minimum RI threshold

**Reward Setup**

- Creator MUST lock reward pool (GNC or NFT)
- Reward pool MUST satisfy minimum requirements
- Reward distribution MUST be valid (non-zero)

**Metadata**

- `challenge-meta` MUST conform to BER schema
- Challenge `duration` MUST be ≤ `max_duration`
- Metadata size MUST be ≤ `max_metadata_size`

If any check fails, Workers MUST reject before Phantom Mode.

## 3. Metadata Structure (BER)

### 3.1 Formal Schema — challenge-meta.ber

```
ChallengeMeta:
  challenge_id:       u64
  grid_id:            u64
  shard_id:           u64
  creator_subid:      u64
  title:              string
  description:        string
  reward_type:        u8    # 0=GNC, 1=NFT, 2=RI Boost
  reward_amount:      u128  # GNC amount, NFT_ID, or RI delta
  participants_max:   u32
  participants_count: u32
  start_timestamp:    u64
  end_timestamp:      u64
  status:             u8    # 0=ACTIVE, 1=ENDED, 2=EXPIRED
  created_at:         u64
  last_updated:       u64
```

### 3.2 Allowed Mutations

| Field | Condition |
|---|---|
| `participants_count` | On each valid join |
| `status` | Valid FSM transitions only |
| `last_updated` | Any write |

### 3.3 Forbidden Mutations

The following fields MUST remain immutable:

- `challenge_id`
- `grid_id`
- `shard_id`
- `creator_subid`
- `reward_type`
- `reward_amount`
- `start_timestamp`

`start_timestamp` MUST be derived from the deterministic on-chain block timestamp at Vault commit. Creator-supplied backdated or future-dated values are prohibited — the Vault MUST override with the commit block timestamp.

### 3.4 Formal Schema — challenge-proof-meta.ber

```
ProofMeta:
  challenge_id:      u64
  participant_subid: u64
  proof_hash:        hash32
  timestamp:         u64
  validated:         u8
```

## 4. Contract FSM (ChallengeVault)

```
INIT → ACTIVE → ENDED → CLOSED
          │
          └──▶ EXPIRED → CLOSED
```

| State | Meaning |
|---|---|
| `ACTIVE` | Participants may join and submit proofs |
| `ENDED` | All required actions completed; ready for distribution |
| `EXPIRED` | Ended automatically due to `end_timestamp` timeout |
| `CLOSED` | Final state after reward distribution |

`CLOSED` is the terminal state. Both `ENDED` and `EXPIRED` paths converge at `CLOSED` after reward distribution completes.

## 5. Phantom Mode Simulation

When a creator initializes a challenge, Phantom Mode MUST simulate:

- Reward pool locking
- Participant limits
- Challenge duration and expiry
- Challenge visibility preview
- `metadata_diff_hash`
- Expected cost (execution fee only)

Simulation output:

```
simulation_result:
  challenge_id
  creator_subid
  reward_type
  reward_amount
  duration
  metadata_diff_hash
  expected_visibility_score
```

Execution MUST strictly match simulation.

## 6. Joining a Challenge

Participants join through the ChallengeVault join flow.

**Preconditions for join:**

- `challenge.status = ACTIVE`
- `participants_count < participants_max`
- Participant SubID role MUST match challenge type: `TraderID` for Trader challenges, `ProviderID` for Builder challenges, any role for General challenges
- RI ≥ participation threshold

**Phantom Mode simulation for join:**

- Updates to `participants_count`
- Preview of ranking score
- Any participation staking requirement (optional, challenge-defined)

Workers MUST ensure no double-joins.

On successful join, `participants_count` increment and join receipt commit MUST occur within the same atomic Vault execution block. No partial join state is permitted. Two concurrent join requests MUST be serialized — the second MUST re-validate `participants_count < participants_max` after the first commits.

On successful join:

- `participants_count` increments by 1
- Join proof logged in `challenge-proof-meta`

## 7. Proof Submission (Task Completion)

Participants submit proofs via receipt hashes, oracle hashes, or meta-evidence (image hash, code submission hash, link hash).

Workers MUST validate:

- Proof authenticity
- Proof meets challenge criteria
- Timestamp within `[start_timestamp, end_timestamp]`
- No duplicate submissions for the same `participant_subid`
- `challenge_id` matches

Proof validation MUST resolve to a deterministic boolean before any metadata mutation. Proof acceptance MUST be hash-bound to oracle input — no discretionary approval is permitted.

**Unvalidated proofs at timeout:** If a proof is submitted before `end_timestamp` but not yet validated when the challenge transitions to `EXPIRED`, it MUST be automatically marked invalid. No validation window extends beyond `end_timestamp`. Challenge finalization MUST NOT be blocked by pending proofs.

On pass, ChallengeVault stores the `ProofMeta` record.

## 8. Ending the Challenge

A challenge ends when either:

1. Creator calls `endChallenge()` (manual close), or
2. `now >= end_timestamp` (system timeout)

Workers MUST compute:

- Total valid proofs
- Winner selection (if challenge has winners)
- Reward shares

ChallengeVault transitions to `ENDED` (manual) or `EXPIRED` (timeout).

## 9. Reward Distribution

Reward distribution is performed through one multi-recipient TX:

```
payout_map = [
  {participant_subid_1, reward_amount_1},
  {participant_subid_2, reward_amount_2},
  ...
  {treasury_subid,      governance_fee},
  {creator_subid,       unused_reward_refund}  # optional
]
```

**Supported reward types:**

**A. GNC Reward** — Pool locked at creation; distributed using exact shares. All arithmetic MUST use integer-only math.

**B. NFT Reward** — NFT transferred from creator to winner within the same atomic TX.

**C. Reputation Reward** — Worker sends RI update event to ReputationVault. RI rewards MUST be emitted as deterministic ReputationVault events and processed through the canonical Reputation Engine mutation path. Direct Worker mutation of RI is prohibited. `reward_amount` for `reward_type = 2` MUST be ≤ `max_RI_boost_per_challenge` as defined in `GlobalConfig`, preventing reward pool inflation abuse.

All distributions are deterministic. Payout map MUST sum to exactly the locked reward pool with no leakage. Unused reward refund MUST equal:

```
unused_reward_refund = locked_reward_pool − sum(distributed_rewards) − governance_fee
```

No arbitrary refund calculation is permitted.

## 10. Worker Validation Rules

Workers MUST enforce:

**On Creation:**

- Valid and locked reward pool
- Metadata schema valid
- Duration within limits
- Creator role valid and RI threshold met

**On Join:**

- Participant eligibility (role and RI)
- `participants_count < participants_max`
- No duplicate entry

**On Proof:**

- Proof hash valid (format and oracle)
- Timestamp within `[start_timestamp, end_timestamp]`
- Challenge status is `ACTIVE`
- No duplicate proof for same participant

**On End:**

- No unvalidated proofs remaining
- `metadata_diff_hash` parity with simulation

**On Distribution:**

- Payout map sums correctly to locked pool
- Multi-output TX validated
- No reward leakage

## 11. Deep-Link Routing

Deep-links use the canonical `gridcode://` scheme.

**Create challenge:**

```
gridcode://challenge/create/<grid_id>/<shard_id>?role=CreatorID
```

**Join challenge:**

```
gridcode://challenge/join/<challenge_id>?role=<SubID>
```

**Submit proof:**

```
gridcode://challenge/proof/<challenge_id>?role=<SubID>
```

Workers MUST verify roles and challenge state at each deep-link resolution.

## 12. Public Market Integration

Challenges are indexed at:

```
public-market-index/challenges/<challenge_id>.json
```

Workers emit `INDEX_HINT` on any `challenge-meta` change. Hint fields: title, reward, expiry, `participants_count`, `creator_ri`, status.

Challenges disappear from visibility when `status = ENDED` or `status = EXPIRED`.

Challenges appear in both Private Marketplace and Public Market → Challenges category.

## 13. Security Model

| Threat | Defense |
|---|---|
| Fake proof submissions | Oracle-proof verification and timestamp enforcement |
| Unauthorized join attempts | Role and RI validation |
| Reward theft or leakage | Multi-output TX and Worker parity check |
| Metadata tampering | Strict immutability and BER checksums |
| Front-running challenge closure | Nonce ordering and Worker locking |
| Replay attacks | Receipt-hash validation |
| Double-join exploit | Worker deduplication on `participant_subid` |
| Premature ending | Worker-controlled FSM transition gates |

Security mechanisms: Worker-only metadata writes, checksum enforcement, simulation parity, immutable reward fields, atomic multi-output reward TX, oracle-proof verification.

## 14. Receipt Structure

**challenge-preconfirm.ber fields:**

```
challenge_id
creator_subid
metadata_diff_hash
simulation_hash
timestamp
```

**challenge-confirm.ber fields:**

```
challenge_id
final_status
payout_map_hash
timestamp
block_height
```

Receipts support: audit, dispute resolution, reputation calculation.

## 15. Compliance Summary

This contract is fully compliant with:

- Whitepaper v3.0 (Challenge Grid model)
- Technical Addendum v3.1 (single multi-output TX, Worker-first validation, Phantom Mode parity)
- GCSPEC v1.1 (FSM, metadata boundaries, transactional execution)
- Runtime Architecture v1.1 (simulation parity, metadata discipline)
- GridNFT Standards v1.3 (ChallengeGrid definition)
- Identity & Reputation Spec v1.2 (RI-based eligibility)
- Activation/GCU model (grid activation constraints)
- Marketplace Fee Table v1.0

## 16. Diagrams

### 16.1 High-Level Challenge Creation Flow

```
Creator (Sponsor / Brand / SubID)
  │
  ▼
Worker validates conditions
  │
  ▼
Phantom Mode Simulation:
  - Reward pool lock preview
  - Duration preview
  - metadata_diff_hash
  │
  ▼
Creator Signs TX
  │
  ▼
ChallengeVault executes
  │
  ▼
Challenge → ACTIVE
```

### 16.2 Challenge Lifecycle FSM

```
INIT → ACTIVE → ENDED ──▶ CLOSED
          │
          └──▶ EXPIRED ──▶ CLOSED
```

### 16.3 Metadata Structure

```
challenge-meta.ber
  challenge_id
  grid_id
  shard_id
  creator_subid
  title
  description
  reward_type        (0=GNC, 1=NFT, 2=RI Boost)
  reward_amount
  participants_max
  participants_count
  start_timestamp
  end_timestamp
  status             (0=ACTIVE, 1=ENDED, 2=EXPIRED)
  created_at
  last_updated

Mutable:   participants_count, status, last_updated
Immutable: challenge_id, grid_id, shard_id, creator_subid,
           reward_type, reward_amount, start_timestamp
```

### 16.4 Preconditions Flow

```
Creator → Create Challenge
  │
  ▼
Worker Preconditions:
  - grid.active = true
  - shard.state = CLAIMED
  - role ∈ {SponsorID, CreatorID, ProviderID}
  - RI >= threshold
  - Reward pool valid (GNC / NFT / RI boost)
  - Metadata schema valid
  - duration <= max_duration
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Phantom Mode
```

### 16.5 Phantom Mode Simulation Flow

```
Phantom Mode Simulation:
  - Reward lock preview
  - Participant limit validation
  - Expiry calculation
  - metadata_diff_hash
  - Expected visibility score (optional)
  │
  ▼
Simulation returned to UI → user signs TX

Simulation MUST match execution.
```

### 16.6 Challenge Join Flow

```
Participant → Join Challenge
  │
  ▼
Worker validates join:
  - challenge.status = ACTIVE
  - participants_count < participants_max
  - SubID role allowed
  - RI threshold met
  - No duplicate join
  │
  ▼
Phantom Mode Join Simulation
  │
  ▼
Participant signs TX

Join updates:
  - participants_count++
  - Join proof logged in challenge-proof-meta
```

### 16.7 Proof Submission Flow

```
Participant → Submit Proof (proof_hash)
  │
  ▼
Worker validates proof:
  - proof_hash valid (format / oracle)
  - timestamp in [start_timestamp, end_timestamp]
  - No duplicate proof for participant_subid
  - Correct challenge_id
  │
  ▼
ChallengeVault stores proof-meta
```

### 16.8 Challenge End (Manual or Timeout)

```
Creator → endChallenge()
  │
  OR
  │
now >= end_timestamp
  │
  ▼
Worker transitions: status → ENDED / EXPIRED
  │
  ▼
Worker computes:
  - Valid proofs
  - Reward shares
  - Eligible winners
  │
  ▼
Vault prepares payout map
```

### 16.9 Reward Distribution — Multi-Recipient TX

```
payout_map = [
  {participant_1, reward_1},
  {participant_2, reward_2},
  ...
  {treasury,      governance_fee},
  {creator,       unused_reward_refund}
]
```

Final Reward Distribution — 1 Atomic TX:

| Recipient | Amount |
|---|---|
| Participant 1..N | `reward_1..N` |
| Treasury | Governance fee |
| Creator (optional) | Unused reward refund |

### 16.10 Public Market Indexing Pipeline

```
challenge-meta changes
  │
  ▼
Worker emits INDEX_HINT:
  - title
  - reward
  - expiry
  - participants_count
  - creator_ri
  - status
  │
  ▼
Public Market re-indexes challenge

Appears in:
  - Private Marketplace
  - Public Market → Challenges category
```

### 16.11 Deep-Link Routing

```
Create Challenge:
  gridcode://challenge/create/<grid_id>/<shard_id>?role=CreatorID

Join Challenge:
  gridcode://challenge/join/<challenge_id>?role=<SubID>

Submit Proof:
  gridcode://challenge/proof/<challenge_id>?role=<SubID>

Resolution pipeline:
  Deep-Link → Worker loads challenge-meta → Phantom Mode →
  Wallet Sign → ChallengeVault Execute → ReceiptConfirm
```

### 16.12 Worker Enforcement

```
Worker Enforcement:
  - Metadata checksum
  - Immutable fields enforcement
  - Reward pool lock correctness
  - Participant limits
  - Proof validity
  - Expiry constraints
  - Simulation parity
  - Payout integrity
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Execute Vault
```

### 16.13 Security Architecture

```
THREAT                              DEFENSE
Fake proof submissions         →  Oracle-proof + timestamp enforcement
Unauthorized join attempts     →  Role / RI validation
Reward theft or leakage        →  Multi-output TX + Worker parity
Metadata tampering             →  Strict immutability + checksums
Front-running challenge close  →  Nonce ordering + Worker locking
Replay attacks                 →  Receipt-hash validation
```

### 16.14 Complete Challenge Lifecycle

```
Creator → CREATE CHALLENGE
  │
  ▼
ACTIVE
  │
  ├── Participants JOIN
  │     │
  │     ▼
  │   Participants SUBMIT PROOFS
  │
  ▼
Challenge ends (manual or timeout)
  │
  ▼
Worker computes results
  │
  ▼
Multi-Recipient Reward Distribution (1 atomic TX)
  │
  ▼
CLOSED
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
- `/docs/identity/reputation-stake-governance-v1.0.md`
- `/docs/nft/gridnft-standards-v1.3.md`
- `/docs/economics/marketplace-fee-table-v1.0.md`
