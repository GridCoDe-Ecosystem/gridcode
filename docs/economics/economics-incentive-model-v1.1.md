---
title: GridCoDe — Economics & Incentive Model
version: v1.1
status: Active Binding
domain: Economics
layer: Economic Architecture & Incentive Design
environment: Gridnet OS
authoritative: true
---

# GridCoDe — Economics & Incentive Model

A Deterministic, Fee-Aware, Multi-Market Economic Framework for GridCoDe.

## 1. Purpose

This document defines the complete economic architecture of GridCoDe, including:

- Reward flows
- Staking incentives
- TrustBond penalties
- Multi-market yield generation
- Fee-aware pricing rules
- Sponsorship revenue
- Marketplace dynamics
- SubID role-based income models
- Deterministic payout systems

Everything here is mapped to:

- Vaults (deterministic economic engines)
- Worker-controlled metadata
- Phantom Mode simulation
- Multi-recipient transactions
- Deep-link onboarding flows
- Visibility/reputation economics

This ensures GridCoDe operates sustainably, profitably, and predictably across all market categories.

## 2. Economic First Principles

GridCoDe economics are governed by six core principles.

### 2.1 Determinism Over Speculation

All rewards and penalties stem from Vault FSMs, never from market speculation or subjective arbitration.

### 2.2 Single-TX Efficiency

Every payout stage uses one multi-recipient transaction, reducing fees and maximizing profit.

### 2.3 Fee-Aware Market Design

GridCoDe respects Gridnet OS fees:

- Minimum job pricing
- Bundled payouts
- Metadata-only steps where possible

### 2.4 Synthetic Staking

All staking yields come from:

- Treasury allocations
- Marketplace volume
- Vault execution fees
- Collateral interest

Not from blockchain inflation.

### 2.5 Role-Based Value Capture (SubIDs)

Value flows differ per SubID role:

- Sellers
- Traders
- Providers
- Participants
- Lenders
- Borrowers
- Sponsors
- Treasury / DAO

### 2.6 Reputation as Economic Leverage

Reputation increases:

- Visibility
- Pricing power
- Marketplace ranking
- Access to premium categories
- Lower TrustBond requirements

Reputation failures reduce economic opportunities.

## 3. GridCoDe Market Ecosystem

GridCoDe consists of several interconnected micro-economies:

1. Store Market
2. Service Market
3. Challenge Market
4. P2P Trade Market
5. Lending Market
6. Insurance Market
7. Sponsorship & Marketplace Activation Market
8. Treasury Revenue Streams

Each produces deterministic yield using Vaults.

## 4. Fee-Aware Economic Model

### 4.1 Minimum Job Price Requirement

A payout must satisfy:

```
payout ≥ transaction_fee × required_steps
```

If not, the Worker SHALL block listing creation. This protects users from negative-profit tasks.

### 4.2 Single-TX Payout Model

All payouts use one multi-output transaction, reducing fees, execution steps, and UX friction.

Mandatory for:

- Store sales
- Service approvals
- Dispute outcomes
- Multi-winner challenges
- Lending interest distributions
- Insurance claims
- Activation revenue splits

### 4.3 Metadata-Only Steps

Evidence submission, listing edits, challenge proof submission, and verification do not incur transactions.

## 5. Multi-Recipient Payout Model

A payout may involve:

- Seller/provider
- Sponsor
- Treasury
- Winners
- Counterparty refund
- Slashing distribution

Vault constructs:

```
PAYOUT = {recipient₁: value, recipient₂: value, ...}
```

Executed atomically as one on-chain TX.

## 6. TrustBond Economics

TrustBond deposits create:

- Incentives for honest behavior
- Automatic slashing for violations
- Reduced fraud risk

### 6.1 Bond Sources

Used in:

- ServiceVault (provider risk)
- ChallengeVault (proof fraud risk)
- InsuranceVault (invalid claim risk)
- LendingVault (borrower credibility boost)

### 6.2 Slashing Outcomes

```
slashed_amount → treasury + counterparty
```

Bond is returned when:

- Service approved
- Challenge valid
- Loan repaid
- Insurance claim legitimate

## 7. Market-Specific Economic Models

### 7.1 Store Market

Participants: Seller (SubID), Buyer, Sponsor, Treasury.

Payout formula:

```
SellerShare  = price - marketplace_fee
SponsorShare = marketplace_fee × sponsor_rate
TreasuryShare = marketplace_fee × treasury_rate
```

Store grids create scalable micro-retail economies.

### 7.2 Service Market

Participants: Funding SubID (Requester), Provider, Sponsor, Treasury.

If APPROVED:

- Provider receives: full reward
- Sponsor receives: sponsor_reward_share
- Treasury receives: treasury_fee
- Provider Bond returned

If REJECTED → DISPUTE → RESOLVED, Vault evaluates evidence and produces one of:

- `PAY_PROVIDER`
- `REFUND_REQUESTER`
- `SLASH_PROVIDER`

### 7.3 Challenge Market

Participants: Competitors, Challenge sponsor, Treasury.

Revenue:

- Entry fees
- Sponsor deposits
- ChallengeGrid staking

Rewards: winners determined by deterministic Vault evaluation. Multi-winner payouts via one TX.

### 7.4 P2P Trade Market

Built on TradeVault's escrowed settlement.

Economic flows:

- Trader profit (spread)
- Sponsor fee share
- Treasury fee share

Incentives: high reputation = more visibility; more visibility = more buyers.

### 7.5 Lending Market

Borrower pays: interest and collateral opportunity cost.

Lender earns: interest and liquidation rewards (if default).

Vault handles:

- Default → liquidation
- Repayment → collateral release

Borrowers with higher reputation and TrustBond receive better terms.

### 7.6 Insurance Market

Funding SubID (insured) pays: premium (metadata-defined).

Provider earns: net premium and reputation increase for fair claims handling.

Claims: Vault evaluates deterministically; multi-output TX for claim payouts.

### 7.7 Sponsorship Market

Sponsors earn:

- Grid-level activation yield
- Store-grid rewards
- Listing commissions
- Shard leasing
- Challenge hosting margins
- Sustained revenue from marketplace volume

Sponsors are long-term economic anchors.

### 7.8 Treasury Revenue Streams

Treasury collects:

- Slashing fees
- Marketplace fees
- Lending liquidation margins
- Insurance denial margins
- Challenge operations fees
- Activation registration
- Upgrade fees

Treasury underwrites:

- Synthetic staking rewards
- GridCoDe development grants
- DAO governance activities

## 8. Role-Based Economic Breakdown

### 8.1 Sellers

- Listing profits
- Store-grid staking share
- Reputation-driven visibility
- Increased pricing power

### 8.2 Service Providers

- Task rewards
- Recurring loyal customers
- Reputation = higher-paying jobs
- Risk of slashing if dishonest

### 8.3 Traders

- Arbitrage profit
- Transaction fee optimization
- Liquidity-based trust

### 8.4 Challenge Participants

- Multi-winner reward opportunities
- Reputation boost
- Tournament-style gains

### 8.5 Lenders

- Interest yields
- Liquidation profit
- Scalable portfolio

### 8.6 Borrowers

- Access to capital
- Better terms as reputation improves

### 8.7 Sponsors

- Long-term passive income
- Marketplace control
- Multi-source revenue stream

### 8.8 Treasury / DAO

- Platform sustainability
- Governance power
- Ability to subsidize markets

## 9. Visibility Index Economics

The Visibility Index (VI) affects profitability:

```
VI = (Reputation × 0.4)
   + (Activity    × 0.3)
   + (Delivery    × 0.2)
   + (Category Fit × 0.1)
```

Listings with higher VI gain:

- More impressions
- More conversions
- Higher revenue
- Better long-term compounding

## 10. Profitability Model for Users

General formula:

```
Net Profit = Reward - (TX fee × TX count)
```

Optimised case (single TX payout):

```
Net Profit = Reward - fee
```

Users can also profit from:

- Staking yields
- Slashing rewards
- Reputation-driven price increases
- Visibility advantages

## 11. Economic Stability Conditions

### 11.1 No Negative-Yield Tasks

Minimum payout rules SHALL be enforced.

### 11.2 No Unbounded Inflation

All staking yield is non-inflationary.

### 11.3 No Exploitable Reward Loops

FSM gating prevents infinite reward conditions.

### 11.4 Slashing Cannot Be Farmed

Vault rules prevent malicious triggering.

## 12. Future Economic Extensibility

The model MAY support future:

- New grid types
- New Vault types
- Cross-chain integrations
- Emerging markets
- New reward mechanisms

All while preserving:

- Deterministic payouts
- Metadata safety
- Fee-awareness
- Reputation anchoring

## 13. Economic Diagrams

### 13.1 Multi-Market Economy Overview

```
┌─────────────────────────────────────────────────────────┐
│               GRIDCODE ECONOMIC ECOSYSTEM                │
├───────────┬────────────┬─────────────┬─────────┬────────┤
│   Store   │  Service   │  Challenge  │  P2P    │Lending │
│   Market  │  Market    │  Market     │  Trade  │ Market │
├───────────┼────────────┼─────────────┼─────────┼────────┤
│ Insurance │ Activation │ Sponsorship │Treasury │ Reputa-│
│  Market   │  Market    │  Economy    │ Revenue │ tion   │
└───────────┴────────────┴─────────────┴─────────┴────────┘
```

### 13.2 Fee-Aware Profitability Model

```
Net Profit = R - (F × S)

  R = Reward
  F = Transaction Fee
  S = Number of TX Steps

When S = 1 (single multi-recipient payout):
  Net Profit = R - F  →  Maximum efficiency
```

### 13.3 Multi-Recipient Vault Payout Flow

```
Vault Computes Payout Allocation
  │
  ▼
ONE Transaction (TX) with Multiple Recipients
  │
  ├──▶ Seller   (X GNC)
  ├──▶ Provider (Y GNC)
  ├──▶ Sponsor  (Z% fee)
  ├──▶ Treasury (T% fee)
  └──▶ Winners  (Wn GNC)
```

### 13.4 Store Market Revenue Distribution

```
STORE SALE (price = P)
  │
  ▼
┌──────────────┬──────────────┬──────────────┐
│ Seller Share │ Sponsor Share│Treasury Share│
│  = P - fee   │= fee × sRate │= fee × tRate │
└──────────────┴──────────────┴──────────────┘
```

### 13.5 Service Market Economic Flow

```
ACCEPT TASK (TX1)
  │
  ▼
ACCEPTED (Locked Fee)
  │
  │  Provider Submits Evidence (no TX)
  ▼
REQUESTER REVIEW
  │
  ├── APPROVE (Vault executes payout: TX2)
  │     │
  │     ▼
  │   Provider Receives Payment
  │   Sponsor Fee Distributed
  │   Treasury Fee Distributed
  │
  └── REJECT → DISPUTE
                │
                ▼
          VAULT EVALUATION (FSM)
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
   PAY      REFUND   SLASH
   PROVIDER REQUESTER PROVIDER
   (TX2)    (TX2)    (TX2)
```

### 13.6 Challenge Market — Multi-Winner Reward Logic

```
Challenge Ends
  │
  ▼
Vault Evaluates Evidence (deterministic FSM)
  │
  ▼
ONE Multi-Recipient Reward Transaction
  ├──▶ Winner #1 → W1 GNC
  ├──▶ Winner #2 → W2 GNC  ...
  ├──▶ Sponsor Share → s%
  └──▶ Treasury Share → t%
```

### 13.7 Lending Market — Economic Lifecycle

```
Borrower INIT Loan
  │
  ▼
COLLATERAL LOCKED (TX1)
  │
  ▼
Loan ACTIVE — Lender funds (TX2)
  │
  ├── Repayment (TX3)          ── Default (timeout)
  │        │                              │
  ▼        ▼                              ▼
  Collateral Freed             Liquidation (TX3)
  Lender Earns Interest        Lender Earns Reward
```

### 13.8 Insurance Market — Claim Economics

```
Premium Paid
  │
  ▼
COVERED (Active Policy)
  │
  │  Claim Submitted (metadata)
  ▼
REVIEW BY VAULT
  │
  ├── APPROVE (TX payout) ──▶ PAID
  └── DENY                ──▶ CLOSED
```

### 13.9 Sponsor & Activation Revenue Model

```
Sponsor Activates Grid (TX1)
  │
  ▼
Marketplace Activity Under Their Grid
  │
  ├──▶ Store Sales
  ├──▶ Service Tasks
  └──▶ Challenges
           │
           ▼
  Sponsor Earns:
    - Share of store fees
    - Share of service fees
    - Share of challenge flows
    - Shard rentals
    - Repeat activations
```

### 13.10 Reputation & Visibility Feedback Loop

```
Good Performance (on-time delivery)
  │
  ▼
Higher Reputation Score
  │
  ▼
Higher Visibility Index
  │
  ▼
More Orders / Sales
  │
  ▼
Higher Earnings

Negative performance inverts the loop.
```

---

**Canonical Status:** Active Binding
**Last Reviewed:** 2026-02
**Supersedes:** v1.0
**Requires:**
- `/docs/identity/subid-role-technical-spec-v1.2.md`
- `/docs/identity/reputation-stake-governance-v1.0.md`
- `/docs/runtime/contract-specification-gcspec-v1.1.md`
