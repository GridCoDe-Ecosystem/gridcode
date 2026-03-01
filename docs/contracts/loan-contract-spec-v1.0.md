---
title: GridCoDe — Loan Contract Specification
version: v1.0
status: Active Binding
domain: Contracts
layer: Contract Specification — LendingVault
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Loan Contract Specification

## 1. Purpose

The Loan Contract allows:

**Borrowers** to:

- Lock collateral in a CollateralGridNFT shard
- Request a loan from a LendingVault
- Receive funds upon approval

**Lenders (Vault or Pools)** to:

- Supply liquidity into LendingVault
- Earn yield from interest and fees

**LendingVault** to:

- Validate borrower eligibility (RI-based)
- Hold collateral
- Track loan state
- Compute and distribute interest
- Handle repayment, default, and liquidation

This contract is the core of GridCoDe's trustless finance layer.

## 2. Preconditions

Before a Loan Contract can be initiated, Workers MUST enforce:

**Borrower**

- SubID role MUST be `BorrowerID`
- MUST control a CollateralGrid shard
- RI MUST be ≥ `RI_min_borrow`
- MUST have no active default flags
- MUST NOT exceed `max_concurrent_loans`

**Collateral**

- CollateralGrid shard MUST be `CLAIMED`
- Collateral type MUST be allowed (GNC or whitelisted NFT)
- Collateral amount MUST be ≥ minimum required
- Collateral MUST be fully unlocked (no active escrows)

**LendingVault**

- MUST have sufficient liquidity
- MUST support the requested asset type
- MUST have active interest-rate configuration
- MUST NOT be in a paused or maintenance state

If any check fails, Worker MUST block before Phantom Mode.

## 3. Metadata Structure (BER)

### 3.1 Formal Schema — loan-meta.ber

```
LoanMeta:
  loan_id:              u64
  borrower_subid:       u64
  lender_pool_id:       u64
  grid_id:              u64   # CollateralGrid ID
  shard_id:             u64   # collateral shard
  collateral_amount:    u128
  loan_amount:          u128
  interest_rate_bps:    u32
  interest_accrued:     u128
  start_timestamp:      u64
  due_timestamp:        u64
  status:               u8    # 0=ACTIVE, 1=REPAID, 2=DEFAULTED, 3=LIQUIDATED
  created_at:           u64
  last_updated:         u64
```

### 3.2 Allowed Mutations

| Field | Mutation |
|---|---|
| `interest_accrued` | Update |
| `status` | Update |
| `last_updated` | Update |

### 3.3 Forbidden Mutations

The following fields MUST remain immutable:

- `borrower_subid`
- `collateral_amount`
- `loan_amount`
- `interest_rate_bps`
- `start_timestamp`
- `due_timestamp`

## 4. Contract FSM (Loan Lifecycle)

```
INIT → ACTIVE → REPAID → CLOSED
          │
          └── (missed deadline) ──▶ DEFAULTED → LIQUIDATED → CLOSED
```

| State | Meaning |
|---|---|
| `ACTIVE` | Loan funded and ongoing |
| `REPAID` | Borrower repaid principal and interest |
| `DEFAULTED` | Borrower missed `due_timestamp` |
| `LIQUIDATED` | Collateral sold to cover the debt |

`REPAID` and `LIQUIDATED` are terminal states. `CLOSED` is a logical archival condition used in FSM diagrams to denote finality — it is not a distinct encoded `status` value. A loan is considered closed when its `status` is `REPAID` or `LIQUIDATED` and no further transitions are possible.

## 5. Phantom Mode Simulation

Simulation MUST compute:

- Borrower eligibility
- Collateralization ratio (LTV)
- Interest rate adjustments based on RI
- Loan amount boundaries
- Repayment schedule preview
- Liquidation threshold preview
- `metadata_diff_hash`

Simulation output:

```
simulation_result:
  loan_id
  borrower_subid
  max_ltv
  loan_amount_approved
  interest_rate_bps
  due_timestamp
  metadata_diff_hash
```

Workers MUST enforce strict parity between simulation and execution.

## 6. Vault Execution — Loan Creation

Steps performed by LendingVault:

1. Lock collateral from CollateralGrid shard
2. Debit lending pool → credit borrower `loan_amount`
3. Write `loan-meta` (`status = ACTIVE`)
4. Emit `ReceiptPreconfirm`
5. Commit state to ledger
6. Emit `ReceiptConfirm`

Borrower now has active debt.

## 7. Interest Accrual

Interest accrues as:

```
interest = principal × (rate_bps / 10000) × (elapsed_time / epoch_duration)
```

Implementation constraints:

- All arithmetic MUST use integer-only (fixed-point) math. Floating-point operations are prohibited.
- `elapsed_time` MUST be injected deterministically by the Vault using on-chain timestamps — never derived from off-chain clocks.
- `epoch_duration` MUST be sourced from `GlobalConfig` and treated as immutable for the life of the loan.
- All intermediate values MUST be computed within `u128` boundaries to prevent overflow.

Accrual triggers:

- At repayment
- At state transitions (`DEFAULTED`, `LIQUIDATED`)
- Periodically if triggered by Vault (configurable)

RI-based rate discount:

```
effective_rate = base_rate × (1 - RI_discount_factor(RI))
```

Borrowers with higher RI pay lower effective interest rates.

## 8. Repayment Flow

1. Borrower stakes required repayment amount (principal + accrued interest)
2. Phantom Mode simulates final payoff
3. Vault executes:
   - Credit lender pool
   - Unlock collateral
   - Update `loan-meta` → `REPAID` → `CLOSED`
4. Worker emits receipts

Repayment uses one multi-recipient TX:

```
[
  {lender_pool, repayment_amount},
  {borrower,    collateral_return}
]
```

## 9. Default & Liquidation

If `now > due_timestamp`, the loan enters `DEFAULTED` state. This transition is deterministic and enforced by Worker timestamp check.

**Liquidation steps:**

1. Vault computes total debt = `principal + interest`
2. Vault revalues collateral (oracle price or deterministic formula)
3. If `collateral >= debt` → return remainder to borrower
4. If `collateral < debt` → full collateral seized
5. Update `loan-meta` → `LIQUIDATED` → `CLOSED`
6. Lender pool receives liquidated collateral value

## 10. Fee Model

**Loan creation fee** (optional, configurable):

- 0%–1% of loan amount
- Split between Treasury and Sponsor

**Liquidation fee:**

- 1% of recovered collateral sent to Treasury

**Repayment:**

- No additional fees beyond interest

## 11. Worker Validation Rules

Workers MUST enforce:

**On Creation:**

- RI ≥ threshold
- Collateral coverage (LTV ≤ max)
- Metadata schema valid
- Vault liquidity available
- Simulation parity confirmed

**On Repayment:**

- Borrower identity verified
- Payoff covers all accrued interest
- Collateral unlock conditions met

**On Default:**

- Deterministic timestamp check

**On Liquidation:**

- Oracle price integrity verified
- `payout_map` correctness verified
- Metadata immutability enforced

## 12. Deep-Link Routing

Deep-links use the canonical `gridcode://` scheme.

**Create loan:**

```
gridcode://loan/create/<grid_id>/<shard_id>?role=BorrowerID
```

**Repay loan:**

```
gridcode://loan/repay/<loan_id>?role=BorrowerID
```

**Liquidation** is triggered by Workers, not by UI, and executed through the LendingVault maintenance flow.

## 13. Public Market Integration

Loans do not appear in the Public Market. However:

- CollateralGrid shards appear in Private Marketplaces
- Lender Pools appear in Public Vault listings
- Borrowers' RI changes affect their Public Profile

## 14. Security Model

| Threat | Defense |
|---|---|
| Under-collateralized borrowing | LTV enforcement |
| Rate manipulation | Worker-controlled rate config |
| Default bypass | Automatic timestamp check |
| Oracle spoofing | Worker oracle-signature verification |
| Replay attacks | Receipt hashes and nonce rules |
| Collateral theft | Worker locks collateral and validates transitions |
| Metadata corruption | Strict BER schema and immutability |
| Simulation mismatch | Full parity enforcement |

Security mechanisms: Worker-first architecture, strict metadata boundaries, oracle verification, simulation parity, multi-output TX enforcement, deterministic liquidation logic.

## 15. Receipt Structure

**loan-preconfirm.ber fields:**

```
loan_id
borrower_subid
collateral_amount
loan_amount
metadata_diff_hash
timestamp
```

**loan-confirm.ber fields:**

```
loan_id
status
payout_map_hash
block_height
timestamp
```

Receipts support dispute resolution, RI updates, and lender auditing.

## 16. Compliance Summary

This contract is fully compliant with:

- Whitepaper v3.0
- Technical Addendum v3.1
- Identity & Reputation v1.2 (RI-based lending)
- GridNFT Standards v1.3 (Collateral Grids)
- Landlord–Tenant Yield Model (reputation-sensitive contributions)
- GCSPEC v1.1
- Runtime Architecture v1.1
- LendingVault Specification

## 17. Diagrams

### 17.1 High-Level Loan Lifecycle

```
Borrower → Create Loan
  │
  ▼
Worker validates conditions
  │
  ▼
Phantom Mode Simulation
  - LTV
  - RI-based rate
  - Liquidity preview
  │
  ▼
Borrower Signs TX
  │
  ▼
LendingVault executes loan
  │
  ▼
Loan → ACTIVE
  │
  ├── Repayment ──▶ REPAID ──▶ CLOSED
  └── Missed Deadline ──▶ DEFAULTED ──▶ LIQUIDATED ──▶ CLOSED
```

### 17.2 Loan FSM

```
INIT → ACTIVE → REPAID → CLOSED
          │
          └──▶ DEFAULTED → LIQUIDATED → CLOSED
```

### 17.3 Metadata Structure

```
LoanMeta
  loan_id
  borrower_subid
  lender_pool_id
  grid_id              (CollateralGrid)
  shard_id             (collateral slot)
  collateral_amount
  loan_amount
  interest_rate_bps
  interest_accrued
  start_timestamp
  due_timestamp
  status               (0=ACTIVE, 1=REPAID, 2=DEFAULTED, 3=LIQUIDATED)
  created_at
  last_updated

Mutable:   interest_accrued, status, last_updated
Immutable: loan_amount, borrower_subid, collateral_amount, interest_rate_bps, timestamps
```

### 17.4 Preconditions Check

```
Borrower → Request Loan
  │
  ▼
Worker Preconditions:
  - Borrower role = BorrowerID
  - CollateralGrid shard CLAIMED
  - Collateral >= minimum required
  - RI >= RI_min_borrow
  - Vault has liquidity
  - LTV within limits
  - No active default flags
  │
  ├── FAIL ──▶ Reject TX
  └── PASS ──▶ Phantom Simulation
```

### 17.5 Phantom Mode Simulation Pipeline

```
Phantom Mode Simulation:
  - Compute LTV (collateral vs. requested loan)
  - Validate RI discount on interest
  - Compute interest rate (effective_rate)
  - Check vault liquidity
  - Determine approved loan_amount
  - Compute due_timestamp
  - Produce metadata_diff_hash
  │
  ▼
Simulation → UI → Borrower signs
```

### 17.6 Vault Execution for Loan Creation

```
LendingVault
  │
  ├── 1. Lock Collateral (CollateralGrid shard)
  ├── 2. Debit Lending Pool → Credit Borrower (loan_amount)
  ├── 3. Write loan-meta (status = ACTIVE)
  ├── 4. Emit ReceiptPreconfirm
  ├── 5. Commit TX
  └── 6. Emit ReceiptConfirm
```

### 17.7 Interest Accrual

```
interest = principal × (rate_bps / 10000) × (time_elapsed / epoch_duration)

effective_rate = base_rate × (1 - RI_factor(RI))

Loan ACTIVE
  │
  ▼
Time passes → interest_accrued increases
  │
  ▼
Borrower repays → total due = loan + interest
```

### 17.8 Repayment Flow

```
Borrower → Repay Loan
  │
  ▼
Worker validates payoff
  │
  ▼
Phantom Mode → determines final payoff packet
  │
  ▼
Borrower signs TX
  │
  ▼
LendingVault Execution:
  - Credit lender_pool
  - Unlock collateral
  - Update loan-meta (REPAID → CLOSED)
  - Emit receipts

Repayment output:
  [{lender_pool, payoff_amount}, {borrower, collateral_return}]
```

### 17.9 Default & Liquidation Sequence

```
due_timestamp reached
  │
  ▼
status → DEFAULTED
  │
  ▼
Liquidation Triggered
  │
  ▼
LendingVault computes:
  - debt = principal + interest
  - oracle_price(collateral)
  │
  ├── collateral >= debt ──▶ lender paid; borrower receives leftover
  └── collateral < debt  ──▶ lender receives full collateral
  │
  ▼
status → LIQUIDATED → CLOSED
```

### 17.10 Liquidation Payout Map

```
payout_map = [
  {lender_pool,  liquidation_value},
  {borrower,     leftover_collateral (if any)},
  {treasury,     liquidation_fee}
]
```

Liquidation Settlement — 1 Atomic TX:

| Recipient | Amount |
|---|---|
| Lender | Principal + interest (up to collateral value) |
| Borrower | Leftover collateral (if any) |
| Treasury | Liquidation fee (1%) |

### 17.11 Worker Enforcement Logic

```
Loan Creation:       LTV check, RI threshold, vault liquidity,
                     metadata checksum, simulation parity
                     │
Repayment:           payoff >= total due, borrower identity,
                     unlock collateral rules
                     │
Default:             timestamp reached
                     │
Liquidation:         oracle price integrity, payout_map correctness
                     │
                     └── PASS ──▶ Execute Vault
```

### 17.12 Deep-Link Routing

```
Loan Creation:
  gridcode://loan/create/<grid_id>/<shard_id>?role=BorrowerID

Repayment:
  gridcode://loan/repay/<loan_id>?role=BorrowerID

Deep-link workflow:
  User click → Worker resolves → Phantom Mode →
  Wallet sign → LendingVault execute → ReceiptConfirm
```

### 17.13 Complete Loan Lifecycle

```
Borrower → CREATE LOAN
  │
  ▼
ACTIVE
  │
  ├── REPAY (on time) ──▶ REPAID ──▶ CLOSED
  └── Missed Deadline ──▶ DEFAULTED ──▶ LIQUIDATED ──▶ CLOSED
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
