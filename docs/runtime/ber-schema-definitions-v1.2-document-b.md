---
title: GridCoDe — BER Schema Definitions (Document B)
version: v1.2
status: Active Binding
domain: Runtime
layer: Metadata Schema — Vault-Specific Schemas
environment: Gridnet OS
authoritative: true
---

# GridCoDe — BER Schema Definitions (Document B)

Vault-Specific BER Schemas. This document defines the canonical BER schema structures for all Vault domains: StoreVault, ServiceVault, ChallengeVault, TradeVault, LendingVault, InsuranceVault, and ActivationVault, plus cross-cutting validation rules and examples.

## 1. Implementation Notes (Global)

These rules apply across all schemas in this document:

- Every `.ber` file MUST include at the top level: `version` (u8), `checksum` (u128), `created_at` (u64), `last_updated` (u64). Workers MUST reject files failing checksum or schema version mismatch.
- `checksum` is calculated over the BER-encoded body excluding the checksum field itself. Canonical encoding order MUST be used.
- Use standard field ordering and explicit types. Avoid optional fields without explicit presence flags to keep BER deterministic.
- `id` refers to u64 stable identifiers. `subid` fields reference SubID ids (u64). `hash32` is a 32-byte SHA-256 digest.
- Timestamps are UNIX epoch seconds (u64).
- Workers return normalized JSON-friendly projections for UIs. BER MUST NOT be parsed manually in frontends.

## 2. StoreVault Schemas

### 2.1 listing-meta.ber

**Formal Schema**

```
ListingMeta:
  version:                      u8
  checksum:                     u128
  listing_id:                   id
  grid_id:                      id
  shard_id:                     id
  seller_subid:                 id
  title:                        string
  description:                  string
  price_gnc:                    u64
  currency:                     string   # "GNC" (primary) or synthetic token tag
  quantity:                     u32      # remaining units; ignored when is_unbounded = true
  is_unbounded:                 bool     # true for digital/unlimited goods; overrides quantity
  delivery_terms:               string   # e.g. "digital", "shipped", "local_pickup"
  fulfillment_window_seconds:   u32
  listing_state:                u8       # 0=Active, 1=SoldOut, 2=Paused, 3=Removed
  visibility_score_override:    i32?     # optional; presence flag required
  tags:                         [string]
  seller_reputation_snapshot:   u32
  created_at:                   u64
  last_updated:                 u64
```

**Explanation & Developer Notes**

Represents an item for sale in StoreVault. `quantity` controls availability. For digital or unlimited goods, `is_unbounded` MUST be set to `true`; when set, `quantity` is ignored by the Worker.

`visibility_score_override` is optional — if present, Worker will accept only if accompanied by `visibility_override_present: bool` (explicit presence flags avoid ambiguous BER decoding).

`price_gnc` MUST satisfy `price_gnc >= GlobalConfig.min_job_price`. Workers validate.

When a buyer accepts, StoreVault uses this metadata to simulate payout and create a single multi-recipient TX.

Common pitfalls:

- Forgetting to update `last_updated` on state changes
- Not recalculating `checksum` after edits — Worker will reject

Worker behavior:

- Validate `seller_reputation_snapshot` against ReputationVault; warn if discrepancy
- Normalize `tags` to lowercase and deduplicate for indexing

### 2.2 order.ber

**Formal Schema**

```
Order:
  version:                  u8
  checksum:                 u128
  order_id:                 id
  listing_id:               id
  buyer_subid:              id
  seller_subid:             id
  quantity:                 u32
  unit_price_gnc:           u64
  total_price_gnc:          u128
  fee_breakdown:
    marketplace_fee_gnc:    u64
    sponsor_fee_gnc:        u64
    treasury_fee_gnc:       u64
  payment_state:            u8       # 0=Pending, 1=Escrowed, 2=Paid, 3=Refunded, 4=Cancelled
  delivery_info:            bytes    # optional structured JSON bytes (hashed)
  evidence_hashes:          [hash32] # proofs, receipts, invoices
  created_at:               u64
  last_updated:             u64
```

**Explanation & Developer Notes**

Created when a buyer initiates purchase and enters escrow (StoreVault transition).

`total_price_gnc` MUST equal `unit_price_gnc × quantity`. Workers verify.

`fee_breakdown` must sum consistently and match `GridMeta.reward_model` percentages. Mismatch results in rejection.

Delivery evidence (tracking numbers, etc.) is stored as a hashed payload to keep BER size predictable. Worker indexes the hash for disputes.

When the transaction confirms, `payment_state` becomes `Paid` and `order.ber` is updated with `evidence_hashes`.

## 3. ServiceVault Schemas

### 3.1 service-task.ber

**Formal Schema**

```
ServiceTask:
  version:                    u8
  checksum:                   u128
  task_id:                    id
  grid_id:                    id
  shard_id:                   id
  requester_subid:            id
  provider_subid:             id?      # optional until accepted
  service_description:        string
  scope_hash:                 hash32   # hash of scope doc or terms
  agreed_price_gnc:           u64
  trustbond_required_gnc:     u64
  status:                     u8       # 0=Open, 1=Accepted, 2=Submitted,
                                       #  3=InReview, 4=Paid, 5=Disputed,
                                       #  6=Resolved, 7=Closed
  evidence_list:              [hash32]
  deadline_timestamp:         u64
  dispute_window_seconds:     u32
  payout_map:                 [(subid: id, amount_gnc: u64)]  # multi-recipient split preview
  created_at:                 u64
  last_updated:               u64
```

**Explanation & Developer Notes**

`scope_hash` anchors the contractual terms and MUST be included in Phantom Mode simulation.

`trustbond_required_gnc` indicates the provider must lock that amount as TrustBond. Workers validate provider TrustBond availability before allowing the Accept transition.

`payout_map` is the predicted split (provider/sponsor/treasury). It is advisory but MUST match Vault computed payouts at execution. Mismatch causes Phantom Mode to fail.

Evidence is stored as content-addressed hashes. Workers retrieve summary info for UI; actual evidence payloads live in an off-chain DFS referenced by hash.

Common pitfalls:

- Leaving `provider_subid` null then attempting to finalize — simulation will fail
- Setting `dispute_window_seconds` inconsistent with `GlobalConfig`

### 3.2 evidence-meta.ber

**Formal Schema**

```
Evidence:
  version:            u8
  checksum:           u128
  evidence_id:        id
  task_or_challenge_id: id
  uploader_subid:     id
  evidence_type:      u8       # 0=image, 1=pdf, 2=tracking_link, 3=code-snippet, 4=other
  evidence_uri_hash:  hash32   # content-addressed pointer to storage
  thumb_hash:         hash32?  # optional
  timestamp:          u64
  signature:          bytes?   # optional signer if off-chain signed
  last_updated:       u64
```

**Explanation & Developer Notes**

Workers index `evidence_uri_hash` for quick retrieval. UIs request via Worker to fetch previews.

Evidence is immutable once accepted into `service-task` unless dispute resolution requires additional evidence.

`signature` field allows provider/requester to attach an off-chain signature proving origin.

Storage notes:

- Always store actual evidence in DFS (IPFS-style) and reference by hash
- Workers validate that referenced URIs return hash-matching content when feasible

## 4. ChallengeVault Schemas

### 4.1 challenge-state.ber

**Formal Schema**

```
ChallengeState:
  version:                      u8
  checksum:                     u128
  challenge_id:                 id
  grid_id:                      id
  sponsor_subid:                id
  entry_fee_gnc:                u64
  max_participants:             u32
  participants:                 [{
                                  participant_subid: id,
                                  entry_tx_hash:    hash32,
                                  joined_at:        u64
                                }]
  ruleset_hash:                 hash32
  submissions_deadline:         u64
  evaluation_window_seconds:    u32
  winners:                      [{subid: id, prize_gnc: u64}]?  # optional until resolved
  status:                       u8   # 0=Open, 1=Closed, 2=Evaluating,
                                     #  3=Resolved, 4=Cancelled
  created_at:                   u64
  last_updated:                 u64
```

**Explanation & Developer Notes**

`participants` list MUST store entry receipt hashes. Workers can re-check mempool/chain if necessary for dispute.

`ruleset_hash` points to a deterministic ruleset used in Vault evaluation.

`winners` is filled by Vault deterministic evaluation. Multi-winner payouts are atomically issued via a single TX.

Workers verify `participants` count does not exceed `max_participants` and enforce `entry_fee_gnc` correctness.

### 4.2 challenge-submission.ber

**Formal Schema**

```
ChallengeSubmission:
  version:                u8
  checksum:               u128
  submission_id:          id
  challenge_id:           id
  participant_subid:      id
  submission_hash:        hash32   # proof data pointer
  submission_timestamp:   u64
  metadata:               bytes?   # optional structured JSON bytes (hashed)
  last_updated:           u64
```

**Explanation & Developer Notes**

Submissions MUST be immutable after the submission deadline.

Vault evaluation compares `submission_hash` values per `ruleset_hash`.

Workers index submission metadata for search and evaluation performance.

## 5. TradeVault Schemas

### 5.1 trade-offer.ber

**Formal Schema**

```
TradeOffer:
  version:            u8
  checksum:           u128
  offer_id:           id
  trader_subid:       id
  asset_in:           string   # e.g. "GNC", "TOKEN_X"
  amount_in:          u128
  asset_out:          string
  amount_out:         u128
  min_trade_size:     u128
  max_trade_size:     u128
  expiry_timestamp:   u64
  escrow_state_id:    id?      # references escrow entry if accepted
  created_at:         u64
  last_updated:       u64
```

**Explanation & Developer Notes**

Represents a P2P offer. `min_trade_size` and `max_trade_size` ensure partial fills are controlled by Vault logic.

When a buyer accepts, TradeVault creates an `escrow-state.ber` instance referenced by `escrow_state_id`.

Workers ensure asset amounts and formats conform to registry.

### 5.2 escrow-state.ber

**Formal Schema**

```
EscrowState:
  version:          u8
  checksum:         u128
  escrow_id:        id
  offer_id:         id
  maker_subid:      id
  taker_subid:      id
  maker_deposit:    [(asset: string, amount: u128)]
  taker_deposit:    [(asset: string, amount: u128)]
  state:            u8   # 0=Open, 1=Escrowed, 2=Released, 3=Cancelled, 4=Disputed
  dispute_info:     bytes?  # optional
  created_at:       u64
  last_updated:     u64
```

**Explanation & Developer Notes**

`maker_deposit` and `taker_deposit` hold asset arrays to support multi-asset trades.

Escrow transitions are deterministic: acceptance → escrowed → release/cancel/dispute.

Phantom Mode simulation MUST be performed to compute expected asset flows and fees prior to signing.

## 6. LendingVault Schemas

### 6.1 loan-state.ber

**Formal Schema**

```
LoanState:
  version:                u8
  checksum:               u128
  loan_id:                id
  borrower_subid:         id
  lender_subid:           id
  principal_gnc:          u128
  interest_rate_bps:      u32    # basis points per annum
  collateral_list:        [id]   # references to collateral.ber entries
  start_timestamp:        u64
  maturity_timestamp:     u64
  repayment_schedule:     bytes? # encoded schedule (optional)
  loan_state:             u8     # 0=Initiated, 1=Active, 2=Repaid, 3=Defaulted, 4=Liquidated
  last_updated:           u64
```

**Explanation & Developer Notes**

`collateral_list` references collateral records. Workers check collateral valuation feeds (oracles or off-chain indices) where applicable. If unavailable, Phantom Mode rejects risky loans.

`interest_rate_bps` and schedule MUST be compatible with `GlobalConfig.schema_versions.loan`.

On default, Vault triggers liquidation logic and writes `loan_state` updates atomically.

### 6.2 collateral.ber

**Formal Schema**

```
Collateral:
  version:              u8
  checksum:             u128
  collateral_id:        id
  owner_subid:          id
  asset:                string
  amount:               u128
  valuation_hash:       hash32   # snapshot of valuation source & timestamp
  locked_by_loan_id:   id?       # optional
  last_updated:         u64
```

**Explanation & Developer Notes**

Collateral entries are created when a borrower locks assets. `valuation_hash` ties collateral to a valuation snapshot used for liquidation thresholds.

Worker MUST enforce that `amount` and `valuation_hash` are present. Vault uses these during liquidation.

## 7. InsuranceVault Schemas

### 7.1 insurance-policy.ber

**Formal Schema**

```
InsurancePolicy:
  version:                  u8
  checksum:                 u128
  policy_id:                id
  insured_subid:            id
  provider_subid:           id
  coverage_limit_gnc:       u128
  premium_gnc:              u64
  premium_schedule_bytes:   bytes?  # optional encoded schedule
  active_from:              u64
  active_until:             u64
  claim_window_seconds:     u32
  policy_state:             u8      # 0=Active, 1=Claimed, 2=Settled, 3=Expired, 4=Cancelled
  created_at:               u64
  last_updated:             u64
```

**Explanation & Developer Notes**

Policy defines premiums and coverage. Workers MUST ensure premiums satisfy `GlobalConfig.min_job_price` rules and check `provider_subid` reputation.

Claims reference `claim.ber` and are evaluated deterministically by InsuranceVault.

### 7.2 claim.ber

**Formal Schema**

```
Claim:
  version:                u8
  checksum:               u128
  claim_id:               id
  policy_id:              id
  claimant_subid:         id
  evidence_hashes:        [hash32]
  claimed_amount_gnc:     u128
  claim_state:            u8   # 0=Submitted, 1=UnderReview, 2=Approved,
                               #  3=Denied, 4=Paid, 5=Closed
  created_at:             u64
  last_updated:           u64
```

**Explanation & Developer Notes**

`evidence_hashes` point to `evidence-meta.ber` entries.

InsuranceVault runs deterministic checks (time windows, coverage limits) before approving. Workers compute expected outcome in Phantom Mode.

## 8. ActivationVault Schemas

### 8.1 activation-grid.ber

**Formal Schema**

```
ActivationGrid:
  version:                    u8
  checksum:                   u128
  activation_id:              id
  sponsor_subid:              id
  grid_template_id:           id
  stake_amount_gnc:           u128
  slots:                      u32
  duration_seconds:           u64
  activation_state:           u8   # 0=Pending, 1=Active, 2=Expired,
                                   #  3=RenewalPending, 4=Revoked
  activation_receipt_hash:    hash32?  # optional until confirmed
  created_at:                 u64
  last_updated:               u64
```

**Explanation & Developer Notes**

Activation flows are long-running. Worker and Runtime MUST enforce `duration_seconds` and expiry rules.

`activation_receipt_hash` links to `receipt-confirm.ber` upon confirmation.

Sponsor economics (rewards) are computed per `GridMeta.reward_model`. Workers compute yield distributions during activation epochs.

## 9. Cross-Cutting Validation Rules & Worker Behaviors

### 9.1 Versioning & Migration

`version` fields follow a semantic upgrade policy: only additive changes are permitted. Unknown fields MUST be ignored by Workers for forward compatibility, provided two conditions hold: (1) canonical BER encoding preserves a stable, deterministic field order so that unknown trailing fields do not alter the checksum region of known fields, and (2) `GlobalConfig.schema_versions` accepts the file version. Workers MUST log unknown fields and continue processing when both conditions are satisfied.

For breaking changes, increment `GlobalConfig.schema_versions` and publish a migration procedure. Workers MUST run a migration check before accepting older schema versions.

### 9.2 Checksum Rules

Use SHA-256 over canonical BER-encoded body bytes, then truncate into u128 (first 16 bytes). Implementation MUST document the consistent method. Workers MUST compute and compare.

### 9.3 Field Presence

Optional fields MUST have explicit presence semantics to avoid ambiguous decoding.

In schema definitions throughout this document, a trailing `?` (e.g. `thumb_hash: hash32?`) denotes TLV presence semantics — the field is encoded with a presence tag and MUST only appear in the BER stream when set. Implementations MUST NOT rely on zero-value or null-value inference. Where TLV is unavailable, an explicit `<field>_present: bool` MUST be included instead.

### 9.4 Size Limits

`max_metadata_size` is enforced by `GlobalConfig`. Workers MUST reject files exceeding the limit to prevent VRAM exhaustion.

### 9.5 Hash References & DFS

All large payloads (images, documents) are stored off-chain (DFS) and referenced by `hash32`. Workers MAY fetch in preview mode. UIs MUST request full content via Worker endpoints.

### 9.6 Phantom Mode Interaction

Workers build a normalized Phantom Mode input by combining relevant `.ber` files (e.g. `listing-meta.ber` + `order.ber` + `global-config.ber`) and returning a deterministic `simulation_result_hash` that MUST match `receipt-preconfirm.simulation_result_hash`.

### 9.7 Security & Anti-Tamper

All metadata mutations MUST be anchored by receipts. If a Worker detects a metadata update without an associated confirmed receipt (or valid preconfirm receipt), it MUST flag for audit.

### 9.8 Common Developer Pitfalls

- Forgetting to recalculate `checksum` after edits — Worker will reject
- Not including `created_at` or `last_updated`
- Relying on optional fields without presence flags
- Not adhering to fee-aware minimums (`GlobalConfig.min_job_price`)
- Batching off-chain evidence without updating hashes in metadata

## 10. Example — listing-meta.ber (Worker Normalization)

```json
{
  "listing_id": 1001,
  "grid_id": 200,
  "shard_id": 10,
  "seller_subid": 50001,
  "title": "Handcrafted Leather Wallet",
  "description": "Premium leather wallet with RFID-blocking",
  "price_gnc": 150000000,
  "currency": "GNC",
  "quantity": 10,
  "is_unbounded": false,
  "delivery_terms": "shipped",
  "fulfillment_window_seconds": 2592000,
  "listing_state": 0,
  "tags": ["leather", "wallet", "handmade"],
  "seller_reputation_snapshot": 720,
  "created_at": 1700000000,
  "last_updated": 1700000000
}
```

Worker encodes to BER, computes checksum, writes `listing-meta.ber`.

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** v1.1
**Requires:**
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
- `/docs/runtime/ber-schema-definitions-v1.2-document-a.md`
