import { describe, it, expect } from "vitest"

import {
  Listing,
  StoreState,
  StoreAction,
  StoreEconomicParams,
  ActionContext,
  Receipt
} from "../engine/types"

import { executeAction } from "../engine/StoreVault"
import { guardReceiptCount } from "../engine/guards"
import { verifyReceiptChain } from "../engine/receipts"

// ---------------------------------------------------------------------------
// Shared fixtures
// All tests use these unless explicitly overriding.
// ---------------------------------------------------------------------------

const baseParams: StoreEconomicParams = {
  minListingPriceGNC:  10,
  fulfillmentWindowMs: 172800000, // 48h
  disputeWindowMs:     86400000   // 24h
}

const T0               = 1000000000000
const T_AFTER_DEADLINE = T0 + 86400000 + 1

const baseListing: Listing = {
  id:                  "listing-001",
  sellerId:            "seller-abc",
  buyerId:             null,
  price:               50,
  state:               StoreState.LISTED,
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
// Helper: advance listing to PURCHASED state
// ---------------------------------------------------------------------------

function makePurchasedListing(): Listing {
  const result = executeAction(
    baseListing,
    StoreAction.PURCHASE,
    {
      actorId:         "buyer-def",
      timestamp:       T0,
      expectedVersion: 1,
      isSystemContext: false,
      escrowTxId:      "tx-001",
      previousHash:    "genesis"
    },
    baseParams
  )
  expect(result.ok).toBe(true)
  return result.listing
}

// ---------------------------------------------------------------------------
// Helper: advance listing to FULFILLED state
// ---------------------------------------------------------------------------

function makeFulfilledListing(): Listing {
  const purchased = makePurchasedListing()
  const result = executeAction(
    purchased,
    StoreAction.FULFILL,
    {
      actorId:           "seller-abc",
      timestamp:         T0,
      expectedVersion:   2,
      isSystemContext:   false,
      deliveryProofHash: "proof-hash-abc",
      previousHash:      "some-hash"
    },
    baseParams
  )
  expect(result.ok).toBe(true)
  return result.listing
}

// ---------------------------------------------------------------------------
// Helper: advance listing to DISPUTED state
// ---------------------------------------------------------------------------

function makeDisputedListing(): Listing {
  const fulfilled = makeFulfilledListing()
  const result = executeAction(
    fulfilled,
    StoreAction.RAISE_DISPUTE,
    {
      actorId:         "buyer-def",
      timestamp:       T0 + 1000,
      expectedVersion: 3,
      isSystemContext: false,
      previousHash:    "some-hash-2"
    },
    baseParams
  )
  expect(result.ok).toBe(true)
  return result.listing
}

// ---------------------------------------------------------------------------
// AT-1: Identity Spoofing — Unknown Actor
// Must use a PURCHASED listing (buyerId assigned) so the stranger is
// genuinely UNKNOWN. On a LISTED listing (buyerId null), any non-seller
// is treated as a prospective buyer by design.
// ---------------------------------------------------------------------------

describe("AT-1: Identity Spoofing — Unknown Actor", () => {
  it("rejects an actor with no relationship to a listing that already has a buyer", () => {
    const purchased = makePurchasedListing() // buyerId = "buyer-def"

    const result = executeAction(
      purchased,
      StoreAction.FULFILL,
      {
        actorId:           "stranger-xyz", // not seller-abc, not buyer-def
        timestamp:         T0,
        expectedVersion:   2,
        isSystemContext:   false,
        deliveryProofHash: "proof-hash",
        previousHash:      "some-hash"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing).toEqual(purchased)
    expect(result.errors[0]).toMatch(/actor identity could not be resolved/i)
    expect(result.listing.receipts).toHaveLength(1)
    expect(result.deltas.sellerDelta).toBe(0)
    expect(result.deltas.buyerDelta).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AT-2: Role Spoofing — Seller Attempts to Buy Own Listing
// ---------------------------------------------------------------------------

describe("AT-2: Role Spoofing — Seller Attempts to Buy Own Listing", () => {
  it("rejects seller attempting PURCHASE on their own listing", () => {
    const result = executeAction(
      baseListing,
      StoreAction.PURCHASE,
      {
        actorId:         "seller-abc",
        timestamp:       T0,
        expectedVersion: 1,
        isSystemContext: false,
        escrowTxId:      "tx-001",
        previousHash:    "genesis"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing).toEqual(baseListing)
    expect(result.errors[0]).toMatch(/role mismatch/i)
    expect(result.listing.receipts).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// AT-3: Unauthorized Transition — Buyer Attempts CANCEL
// ---------------------------------------------------------------------------

describe("AT-3: Unauthorized Transition — Buyer Attempts CANCEL", () => {
  it("variant A: non-seller attempts CANCEL on LISTED listing", () => {
    const result = executeAction(
      baseListing,
      StoreAction.CANCEL,
      {
        actorId:         "buyer-def",
        timestamp:       T0,
        expectedVersion: 1,
        isSystemContext: false,
        previousHash:    "genesis"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing).toEqual(baseListing)
  })

  it("variant B: buyer attempts CANCEL on PURCHASED listing", () => {
    const purchased = makePurchasedListing()
    const result = executeAction(
      purchased,
      StoreAction.CANCEL,
      {
        actorId:         "buyer-def",
        timestamp:       T0,
        expectedVersion: 2,
        isSystemContext: false,
        previousHash:    "some-hash"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing.state).toBe(StoreState.PURCHASED)
  })
})

// ---------------------------------------------------------------------------
// AT-4: Early Finalization — FINALIZE_SETTLEMENT Before Deadline
// ---------------------------------------------------------------------------

describe("AT-4: Early Finalization — FINALIZE_SETTLEMENT Before Deadline", () => {
  it("rejects finalization when timestamp is before settlementDeadline", () => {
    const fulfilled = makeFulfilledListing()

    const result = executeAction(
      fulfilled,
      StoreAction.FINALIZE_SETTLEMENT,
      {
        actorId:         "system",
        timestamp:       T0 + 1000, // well before deadline
        expectedVersion: 3,
        isSystemContext: true,
        previousHash:    "some-hash"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing.state).toBe(StoreState.FULFILLED)
    expect(result.listing.settlementFinalized).toBe(false)
    expect(result.errors[0]).toMatch(/finalization window not yet reached/i)
    expect(result.deltas.sellerDelta).toBe(0)
    expect(result.deltas.buyerDelta).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AT-5: Fulfillment Without Delivery Proof
// ---------------------------------------------------------------------------

describe("AT-5: Fulfillment Without Delivery Proof", () => {
  it("rejects FULFILL when deliveryProofHash is empty string", () => {
    const purchased = makePurchasedListing()
    const result = executeAction(
      purchased,
      StoreAction.FULFILL,
      {
        actorId:           "seller-abc",
        timestamp:         T0,
        expectedVersion:   2,
        isSystemContext:   false,
        deliveryProofHash: "",
        previousHash:      "some-hash"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing.state).toBe(StoreState.PURCHASED)
    expect(result.listing.receipts).toHaveLength(1) // only the PURCHASE receipt
  })

  it("rejects FULFILL when deliveryProofHash is absent", () => {
    const purchased = makePurchasedListing()
    const result = executeAction(
      purchased,
      StoreAction.FULFILL,
      {
        actorId:         "seller-abc",
        timestamp:       T0,
        expectedVersion: 2,
        isSystemContext: false,
        previousHash:    "some-hash"
        // deliveryProofHash intentionally omitted
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing.state).toBe(StoreState.PURCHASED)
  })
})

// ---------------------------------------------------------------------------
// AT-6: Replay Attack — Transition Executed Twice
// ---------------------------------------------------------------------------

describe("AT-6: Replay Attack — Transition Executed Twice", () => {
  it("rejects a replayed FULFILL on an already-FULFILLED listing", () => {
    const fulfilled          = makeFulfilledListing()
    const receiptCountBefore = fulfilled.receiptCount

    const result = executeAction(
      fulfilled,
      StoreAction.FULFILL,
      {
        actorId:           "seller-abc",
        timestamp:         T0,
        expectedVersion:   3,
        isSystemContext:   false,
        deliveryProofHash: "proof-hash-abc",
        previousHash:      "some-hash"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing.receiptCount).toBe(receiptCountBefore)
    expect(result.listing.state).toBe(StoreState.FULFILLED)
  })
})

// ---------------------------------------------------------------------------
// AT-7: Corrupted Aggregate Injection
// ---------------------------------------------------------------------------

describe("AT-7: Corrupted Aggregate Injection", () => {
  it("rejects a listing where state=DISPUTED but disputeRecord=null", () => {
    const corrupt: Listing = {
      ...baseListing,
      state:         StoreState.DISPUTED,
      disputeRecord: null
    }

    const result = executeAction(
      corrupt,
      StoreAction.RESOLVE_SELLER,
      {
        actorId:         "system",
        timestamp:       T0,
        expectedVersion: 1,
        isSystemContext: true,
        evidenceValid:   true,
        previousHash:    "genesis"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing).toEqual(corrupt)
    expect(result.errors[0]).toMatch(/corrupted aggregate/i)
    expect(result.deltas.sellerDelta).toBe(0)
    expect(result.listing.receipts).toHaveLength(0)
  })

  it("rejects a listing where disputeRecord is set but state is not DISPUTED", () => {
    const corrupt: Listing = {
      ...baseListing,
      state:         StoreState.FULFILLED,
      disputeRecord: {
        receiptId:          "fake-receipt",
        raisedBy:           "buyer-def",
        timestamp:          T0,
        evidenceSubmitted:  false,
        resolutionDeadline: T0 + 86400000,
        resolved:           false
      }
    }

    const result = executeAction(
      corrupt,
      StoreAction.FINALIZE_SETTLEMENT,
      {
        actorId:         "system",
        timestamp:       T_AFTER_DEADLINE,
        expectedVersion: 1,
        isSystemContext: true,
        previousHash:    "genesis"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/corrupted aggregate/i)
  })
})

// ---------------------------------------------------------------------------
// AT-8: Determinism Verification
// ---------------------------------------------------------------------------

describe("AT-8: Determinism Verification", () => {
  it("produces byte-for-byte identical output for identical inputs across 3 calls", () => {
    const context: ActionContext = {
      actorId:         "buyer-def",
      timestamp:       T0,
      expectedVersion: 1,
      isSystemContext: false,
      escrowTxId:      "tx-001",
      previousHash:    "genesis"
    }

    const r1 = executeAction(baseListing, StoreAction.PURCHASE, context, baseParams)
    const r2 = executeAction(baseListing, StoreAction.PURCHASE, context, baseParams)
    const r3 = executeAction(baseListing, StoreAction.PURCHASE, context, baseParams)

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
    expect(JSON.stringify(r2)).toBe(JSON.stringify(r3))
  })
})

// ---------------------------------------------------------------------------
// AT-9: Settlement Boundary Race — Dispute vs Finalize at Exact Deadline
// ---------------------------------------------------------------------------

describe("AT-9: Settlement Boundary Race — Exact Deadline", () => {
  it("variant A: rejects RAISE_DISPUTE at timestamp exactly equal to deadline", () => {
    const fulfilled = makeFulfilledListing()
    const deadline  = fulfilled.settlementDeadline!

    const result = executeAction(
      fulfilled,
      StoreAction.RAISE_DISPUTE,
      {
        actorId:         "buyer-def",
        timestamp:       deadline, // exactly at deadline — strictly less-than required
        expectedVersion: 3,
        isSystemContext: false,
        previousHash:    "some-hash"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/dispute window has closed/i)
  })

  it("variant B: rejects FINALIZE_SETTLEMENT at 1ms before deadline", () => {
    const fulfilled = makeFulfilledListing()
    const deadline  = fulfilled.settlementDeadline!

    const result = executeAction(
      fulfilled,
      StoreAction.FINALIZE_SETTLEMENT,
      {
        actorId:         "system",
        timestamp:       deadline - 1, // 1ms before deadline
        expectedVersion: 3,
        isSystemContext: true,
        previousHash:    "some-hash"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/finalization window not yet reached/i)
  })
})

// ---------------------------------------------------------------------------
// AT-10: Version Lock — Concurrent Purchase Attempt
// Both engine calls succeed individually — the engine does not know about
// the concurrent write. Both return version 2. The Adapter's stored-version
// check catches the conflict on the second write attempt — only one buyer
// succeeds at persistence. Version lock enforcement is an Adapter concern.
// ---------------------------------------------------------------------------

describe("AT-10: Version Lock — Concurrent Purchase Attempt", () => {
  it("both engine calls succeed and both return version 2 — Adapter enforces write lock", () => {
    const contextA: ActionContext = {
      actorId:         "buyer-A",
      timestamp:       T0,
      expectedVersion: 1,
      isSystemContext: false,
      escrowTxId:      "tx-A",
      previousHash:    "genesis"
    }
    const contextB: ActionContext = {
      actorId:         "buyer-B",
      timestamp:       T0,
      expectedVersion: 1,
      isSystemContext: false,
      escrowTxId:      "tx-B",
      previousHash:    "genesis"
    }

    const resultA = executeAction(baseListing, StoreAction.PURCHASE, contextA, baseParams)
    const resultB = executeAction(baseListing, StoreAction.PURCHASE, contextB, baseParams)

    // Both succeed at engine level — Adapter enforces the write lock
    expect(resultA.ok).toBe(true)
    expect(resultB.ok).toBe(true)

    // Both return version 2 — Adapter detects conflict on second write
    expect(resultA.listing.version).toBe(2)
    expect(resultB.listing.version).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// AT-11: Idempotent Click Retry
// ---------------------------------------------------------------------------

describe("AT-11: Idempotent Click Retry", () => {
  it("first PURCHASE succeeds; after reload state=PURCHASED means second PURCHASE is rejected", () => {
    const context: ActionContext = {
      actorId:         "buyer-def",
      timestamp:       T0,
      expectedVersion: 1,
      isSystemContext: false,
      escrowTxId:      "tx-001",
      previousHash:    "genesis"
    }

    const call1 = executeAction(baseListing, StoreAction.PURCHASE, context, baseParams)
    expect(call1.ok).toBe(true)
    expect(call1.listing.version).toBe(2)

    // Simulates what happens after Adapter reloads — state is now PURCHASED
    const reloaded = call1.listing
    const call2 = executeAction(
      reloaded,
      StoreAction.PURCHASE,
      { ...context, expectedVersion: 2 },
      baseParams
    )

    expect(call2.ok).toBe(false)
    expect(call2.errors[0]).toMatch(/invalid state/i)
  })
})

// ---------------------------------------------------------------------------
// AT-12: Escrow TxId Absent — Purchase Without Confirmed Escrow
// ---------------------------------------------------------------------------

describe("AT-12: Escrow TxId Absent", () => {
  it("variant A: rejects PURCHASE when escrowTxId is undefined", () => {
    const result = executeAction(
      baseListing,
      StoreAction.PURCHASE,
      {
        actorId:         "buyer-def",
        timestamp:       T0,
        expectedVersion: 1,
        isSystemContext: false,
        escrowTxId:      undefined,
        previousHash:    "genesis"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing.state).toBe(StoreState.LISTED)
    expect(result.listing.buyerId).toBeNull()
    expect(result.errors[0]).toMatch(/escrow confirmation required/i)
  })

  it("variant B: rejects PURCHASE when escrowTxId is empty string", () => {
    const result = executeAction(
      baseListing,
      StoreAction.PURCHASE,
      {
        actorId:         "buyer-def",
        timestamp:       T0,
        expectedVersion: 1,
        isSystemContext: false,
        escrowTxId:      "",
        previousHash:    "genesis"
      },
      baseParams
    )

    expect(result.ok).toBe(false)
    expect(result.listing.buyerId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// AT-13: Receipt Chain Tamper Detection
// ---------------------------------------------------------------------------

describe("AT-13: Receipt Chain Tamper Detection", () => {
  it("variant A: detects receiptHash tampering at index 0", () => {
    const fulfilled = makeFulfilledListing()

    const tampered: Listing = {
      ...fulfilled,
      receipts: [
        { ...fulfilled.receipts[0], receiptHash: "tampered-hash" },
        ...fulfilled.receipts.slice(1)
      ]
    }

    const result = verifyReceiptChain(tampered)
    expect(result.valid).toBe(false)
    expect(result.brokenAtIndex).toBe(0)
  })

  it("variant B: detects receiptHash tampering at index 1", () => {
    const fulfilled = makeFulfilledListing()

    const tampered: Listing = {
      ...fulfilled,
      receipts: [
        fulfilled.receipts[0],
        { ...fulfilled.receipts[1], receiptHash: "tampered-hash-1" }
      ]
    }

    const result = verifyReceiptChain(tampered)
    expect(result.valid).toBe(false)
    expect(result.brokenAtIndex).toBe(1)
  })

  it("variant C: guardReceiptCount detects silent deletion before chain walk", () => {
    const fulfilled = makeFulfilledListing()

    const truncated: Listing = {
      ...fulfilled,
      receipts: fulfilled.receipts.slice(0, 1) // remove second receipt
      // receiptCount still reflects 2
    }

    const countErr = guardReceiptCount(truncated)
    expect(countErr).not.toBeNull()
    expect(countErr).toMatch(/receipt count mismatch/i)
  })
})

// ---------------------------------------------------------------------------
// AT-14: ReceiptCount Mismatch — Truncation and Injection
// ---------------------------------------------------------------------------

describe("AT-14: ReceiptCount Mismatch", () => {
  it("variant A: detects truncation — receiptCount higher than actual receipts", () => {
    const listing: Listing = {
      ...baseListing,
      receiptCount: 3,
      receipts:     []
    }

    const err = guardReceiptCount(listing)
    expect(err).not.toBeNull()
    expect(err).toMatch(/receipt count mismatch/i)
  })

  it("variant B: detects injection — receipts array longer than receiptCount", () => {
    const fulfilled    = makeFulfilledListing()
    const fakeReceipt: Receipt = {
      ...fulfilled.receipts[0],
      receiptId: "injected-receipt"
    }

    const injected: Listing = {
      ...fulfilled,
      receiptCount: 1, // count says 1 but array has 3
      receipts:     [...fulfilled.receipts, fakeReceipt]
    }

    const err = guardReceiptCount(injected)
    expect(err).not.toBeNull()
    expect(err).toMatch(/receipt count mismatch/i)
  })
})
