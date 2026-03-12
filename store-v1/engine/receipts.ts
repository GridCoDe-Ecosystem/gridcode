"use strict"

import { createHash } from "crypto"

import {
  Listing,
  Receipt,
  ReceiptState,
  StoreAction,
  StoreState
} from "./types"

// ---------------------------------------------------------------------------
// Receipt chain verification result.
// Used by verifyReceiptChain() and by the Adapter boundary (AT-13).
// ---------------------------------------------------------------------------

export interface ChainVerificationResult {
  valid:          boolean
  brokenAtIndex?: number
  error?:         string
}

// ---------------------------------------------------------------------------
// Canonical payload for receipt hashing.
// Excludes both previousHash (injected separately as the hash prefix) and
// receiptHash (the computed output — never part of its own input).
// Field order is fixed — any change breaks chain verification.
// ---------------------------------------------------------------------------

function buildCanonicalPayload(
  receipt: Omit<Receipt, "previousHash" | "receiptHash">
): string {
  return [
    receipt.receiptId,
    receipt.listingId,
    receipt.action,
    receipt.fromState,
    receipt.toState,
    receipt.receiptState,
    receipt.actor,
    receipt.timestamp.toString()
  ].join("|")
}

// ---------------------------------------------------------------------------
// Compute the receipt hash.
// receiptHash = SHA256(previousHash + "|" + canonicalPayload)
// The previousHash is always injected by the Adapter — never fetched here.
// ---------------------------------------------------------------------------

export function computeReceiptHash(
  previousHash: string,
  receipt:      Omit<Receipt, "previousHash" | "receiptHash">
): string {
  const payload = buildCanonicalPayload(receipt)
  return createHash("sha256")
    .update(previousHash + "|" + payload)
    .digest("hex")
}

// ---------------------------------------------------------------------------
// Build a new Receipt from transition context.
// Called by transition functions inside transitions.ts — never externally.
// The receiptId is a deterministic composite — no random generation.
// ---------------------------------------------------------------------------

export function buildReceipt(params: {
  listingId:    string
  action:       StoreAction
  fromState:    StoreState
  toState:      StoreState
  receiptState: ReceiptState
  actor:        string
  timestamp:    number
  previousHash: string
  receiptIndex: number
}): Receipt {
  const {
    listingId, action, fromState, toState,
    receiptState, actor, timestamp, previousHash, receiptIndex
  } = params

  const receiptId = `${listingId}-r${receiptIndex}-${action}-${timestamp}`

  const receiptHash = computeReceiptHash(previousHash, {
    receiptId,
    listingId,
    action,
    fromState,
    toState,
    receiptState,
    actor,
    timestamp
  })

  return {
    receiptId,
    listingId,
    action,
    fromState,
    toState,
    receiptState,
    actor,
    timestamp,
    previousHash,
    receiptHash
  }
}

// ---------------------------------------------------------------------------
// Verify the full receipt chain for a listing.
//
// Two checks are applied to every receipt:
//
//   1. Integrity check — recompute SHA256(previousHash + canonicalPayload)
//      and compare against the stored receiptHash. Detects any field
//      tampering on the receipt itself.
//
//   2. Linkage check — each receipt after index 0 must have previousHash
//      equal to the previous receipt's receiptHash. Detects broken chain
//      links regardless of which receipt was altered.
//
//   3. Genesis check — the first receipt must have previousHash = "genesis".
//
// Called by: SimAdapter on every load (Adapter boundary — not dispatcher).
// Detects: tampered receipts (AT-13). Silent deletion is caught first by
// guardReceiptCount in guards.ts before this function is reached.
// ---------------------------------------------------------------------------

export function verifyReceiptChain(listing: Listing): ChainVerificationResult {
  if (listing.receipts.length === 0) {
    return { valid: true }
  }

  for (let i = 0; i < listing.receipts.length; i++) {
  const receipt = listing.receipts[i]

  if (!receipt) {
    return {
      valid: false,
      brokenAtIndex: i,
      error: `Receipt missing at index ${i}.`
    }
  }

  // Genesis check
  if (i === 0 && receipt.previousHash !== "genesis") {
    return {
      valid: false,
      brokenAtIndex: 0,
      error: `Receipt chain broken at index 0: expected previousHash "genesis".`
    }
  }

  // Linkage check — previousHash must equal the previous receipt's receiptHash
  if (i > 0) {
    const prev = listing.receipts[i - 1]

    if (!prev) {
      return {
        valid: false,
        brokenAtIndex: i,
        error: `Previous receipt missing at index ${i - 1}.`
      }
    }

    if (receipt.previousHash !== prev.receiptHash) {
      return {
        valid: false,
        brokenAtIndex: i,
        error: `Receipt chain broken at index ${i}: previousHash does not match previous receiptHash.`
      }
    }
  }

  // Integrity check — recompute hash from fields, compare to stored receiptHash
  const expectedHash = computeReceiptHash(receipt.previousHash, {
    receiptId: receipt.receiptId,
    listingId: receipt.listingId,
    action: receipt.action,
    fromState: receipt.fromState,
    toState: receipt.toState,
    receiptState: receipt.receiptState,
    actor: receipt.actor,
    timestamp: receipt.timestamp
  })

  if (expectedHash !== receipt.receiptHash) {
    return {
      valid: false,
      brokenAtIndex: i,
      error: `Receipt chain broken at index ${i}: receiptHash integrity failure.`
    }
  }
}    

  return { valid: true }
}
