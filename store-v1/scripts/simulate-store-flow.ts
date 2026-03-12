// ---------------------------------------------------------------------------
// store-v1/scripts/simulate-store-flow.ts
//
// CLI simulation of a complete Store v1 trade flow:
//   LISTED → PURCHASE → FULFILL → FINALIZE_SETTLEMENT
//
// Run with: npx tsx store-v1/scripts/simulate-store-flow.ts
// ---------------------------------------------------------------------------

import { SimAdapter } from "../adapter/SimAdapter"
import { StoreAction } from "../engine/types"
import type { Listing, StoreEconomicParams } from "../engine/types"

// ---------------------------------------------------------------------------
// Economic parameters (canonical v1 values)
// ---------------------------------------------------------------------------

const PARAMS: StoreEconomicParams = {
  minListingPriceGNC:  10,
  fulfillmentWindowMs: 172800000, // 48h
  disputeWindowMs:     86400000   // 24h
}

// ---------------------------------------------------------------------------
// Timestamps — injected deterministically, never read from system clock
// in the engine. The adapter owns the clock boundary.
// ---------------------------------------------------------------------------

const T0          = Date.now()
const T_AFTER_DEADLINE = T0 + 3_600_000 + PARAMS.disputeWindowMs + 1000
// ---------------------------------------------------------------------------
// Initial listing
// ---------------------------------------------------------------------------

const INITIAL_LISTING: Listing = {
  id:                  "listing-demo-001",
  sellerId:            "seller-alice",
  buyerId:             null,
  price:               100,
  state:               "LISTED" as any,
  version:             1,
  receiptCount:        0,
  escrowTxId:          null,
  purchaseTxId:        null,
  settlementDeadline:  null,
  settlementFinalized: false,
  deliveryProofHash:   null,
  disputeRecord:       null,
  receipts:            []
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printListing(label: string, listing: Listing): void {
  console.log(`\n── ${label}`)
  console.log(`   state:               ${listing.state}`)
  console.log(`   version:             ${listing.version}`)
  console.log(`   receiptCount:        ${listing.receiptCount}`)
  console.log(`   buyerId:             ${listing.buyerId ?? "null"}`)
  console.log(`   settlementDeadline:  ${listing.settlementDeadline ?? "null"}`)
  console.log(`   settlementFinalized: ${listing.settlementFinalized}`)
  console.log(`   deliveryProofHash:   ${listing.deliveryProofHash ?? "null"}`)
}

function printResult(step: string, ok: boolean, errors: string[]): void {
  if (ok) {
    console.log(`   ✓ ${step}`)
  } else {
    console.log(`   ✗ ${step} FAILED`)
    errors.forEach(e => console.log(`     error: ${e}`))
    process.exit(1)
  }
}

function printReputationLog(adapter: SimAdapter): void {
  const log = adapter.getReputationLog()
  if (log.length === 0) {
    console.log("\n── Reputation Log: (empty)")
    return
  }
  console.log("\n── Reputation Log")
  for (const entry of log) {
    console.log(`   action:      ${entry.action}`)
    console.log(`   seller ${entry.sellerId}: ${entry.sellerDelta >= 0 ? "+" : ""}${entry.sellerDelta}`)
    console.log(`   buyer  ${entry.buyerId}:  ${entry.buyerDelta >= 0 ? "+" : ""}${entry.buyerDelta}`)
  }
}

// ---------------------------------------------------------------------------
// Main simulation
// ---------------------------------------------------------------------------

function run(): void {
  console.log("═══════════════════════════════════════════════")
  console.log("  GridCoDe Store v1 — Simulation Demo")
  console.log("  Flow: LISTED → PURCHASE → FULFILL → FINALIZE")
  console.log("═══════════════════════════════════════════════")

  const adapter = new SimAdapter()
  adapter.seed(INITIAL_LISTING)

  printListing("Initial State", INITIAL_LISTING)

  // ── Step 1: PURCHASE ────────────────────────────────────────────────────

  console.log("\n[1] buyer-bob attempts PURCHASE")

  let r = adapter.execute(
    "listing-demo-001",
    StoreAction.PURCHASE,
    {
      actorId:         "buyer-bob",
      isSystemContext: false,
      escrowTxId:      "escrow-tx-001"
    },
    PARAMS,
    T0
  )

  printResult("PURCHASE", r.ok, r.errors)
  printListing("After PURCHASE", r.listing)

  // ── Step 2: FULFILL ─────────────────────────────────────────────────────

  console.log("\n[2] seller-alice FULFILL with delivery proof")

  r = adapter.execute(
    "listing-demo-001",
    StoreAction.FULFILL,
    {
      actorId:           "seller-alice",
      isSystemContext:   false,
      deliveryProofHash: "ipfs-QmXyz123deliveryproof"
    },
    PARAMS,
    T0 + 3600000 // 1h after purchase
  )

  printResult("FULFILL", r.ok, r.errors)
  printListing("After FULFILL", r.listing)

  // ── Step 3: Phantom Mode preview of FINALIZE_SETTLEMENT ─────────────────

  console.log("\n[3] SYSTEM simulates FINALIZE_SETTLEMENT (phantom mode — no write)")

  const phantom = adapter.simulate(
    "listing-demo-001",
    StoreAction.FINALIZE_SETTLEMENT,
    {
      actorId:         "system",
      isSystemContext: true
    },
    PARAMS,
    T_AFTER_DEADLINE
  )

  console.log(`   phantom ok:                  ${phantom.ok}`)
  console.log(`   projected settlementFinalized: ${phantom.listing.settlementFinalized}`)
  console.log(`   store unchanged after phantom: ${adapter.getListing("listing-demo-001")?.settlementFinalized === false}`)

  // ── Step 4: FINALIZE_SETTLEMENT (live write) ─────────────────────────────

  console.log("\n[4] SYSTEM executes FINALIZE_SETTLEMENT (live write)")

  r = adapter.execute(
    "listing-demo-001",
    StoreAction.FINALIZE_SETTLEMENT,
    {
      actorId:         "system",
      isSystemContext: true
    },
    PARAMS,
    T_AFTER_DEADLINE
  )

  printResult("FINALIZE_SETTLEMENT", r.ok, r.errors)
  printListing("After FINALIZE_SETTLEMENT", r.listing)

  // ── Receipt chain ────────────────────────────────────────────────────────

  console.log("\n── Receipt Chain")
  for (const receipt of r.listing.receipts) {
    console.log(`   [${receipt.receiptId}]  ${receipt.fromState} → ${receipt.toState}`)
    console.log(`     actor: ${receipt.actor}   state: ${receipt.receiptState}`)
    console.log(`     hash:  ${receipt.receiptHash}`)
  }

  // ── Reputation log ───────────────────────────────────────────────────────

  printReputationLog(adapter)

  // ── NFT mint eligibility ─────────────────────────────────────────────────

  const final = r.listing
  const mintEligible = (
    final.state === "FULFILLED" as any &&
    final.settlementFinalized      &&
    final.disputeRecord === null
  )
  console.log(`\n── Entitlement NFT Mint Eligible: ${mintEligible ? "YES ✓" : "NO ✗"}`)

  console.log("\n═══════════════════════════════════════════════")
  console.log("  Simulation complete.")
  console.log("═══════════════════════════════════════════════\n")
}

run()
