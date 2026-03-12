import type {
  Listing,
  StoreEconomicParams,
  ActionContext
} from "../engine/types"

import { StoreAction } from "../engine/types"

import { executeAction } from "../engine/StoreVault"
import type { ActionResult } from "../engine/StoreVault"

import { guardReceiptCount } from "../engine/guards"
import { verifyReceiptChain } from "../engine/receipts"

// ---------------------------------------------------------------------------
// SimAdapter — in-memory simulation adapter for the StoreVault engine.
//
// Responsibilities:
//   1. Own the listing store (Map<id, Listing>)
//   2. Run guardReceiptCount + verifyReceiptChain on every load
//   3. Compute previousHash from the last receipt before every executeAction
//   4. Enforce version lock before every write (optimistic concurrency)
//   5. Persist atomically on success: listing + receipt + reputation deltas
//   6. Never persist on engine failure
//   7. Expose a simulate() path (phantom mode) that never persists
//
// This adapter has no Gridnet OS dependency. It is the proof-of-concept
// execution context used for Store v1 simulation and UI integration.
// The live StorageAdapter will implement the same interface against
// the chain.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AdapterActionParams {
  actorId:           string
  isSystemContext:   boolean
  escrowTxId?:       string
  deliveryProofHash?: string
  evidenceValid?:    boolean
}

export interface ReputationLogEntry {
  listingId:   string
  action:      StoreAction
  timestamp:   number
  sellerDelta: number
  buyerDelta:  number
  sellerId:    string
  buyerId:     string | null
}

export interface SimAdapterResult {
  ok:      boolean
  listing: Listing
  errors:  string[]
}

// ---------------------------------------------------------------------------
// SimAdapter class
// ---------------------------------------------------------------------------

export class SimAdapter {

  private store:          Map<string, Listing>  = new Map()
  private reputationLog:  ReputationLogEntry[]  = []

  // -------------------------------------------------------------------------
  // seed()
  // Insert a listing directly into the store. Used to establish test state.
  // No integrity checks — the caller owns the validity of what they seed.
  // -------------------------------------------------------------------------

  seed(listing: Listing): void {
    this.store.set(listing.id, listing)
  }

  // -------------------------------------------------------------------------
  // getListing()
  // Read a listing from the store without running integrity checks.
  // -------------------------------------------------------------------------

  getListing(listingId: string): Listing | undefined {
    return this.store.get(listingId)
  }

  // -------------------------------------------------------------------------
  // getReputationLog()
  // Returns a copy of the reputation delta log.
  // -------------------------------------------------------------------------

  getReputationLog(): ReputationLogEntry[] {
    return [...this.reputationLog]
  }

  // -------------------------------------------------------------------------
  // reset()
  // Clears all state. Use between tests to guarantee isolation.
  // -------------------------------------------------------------------------

  reset(): void {
    this.store.clear()
    this.reputationLog = []
  }

  // -------------------------------------------------------------------------
  // execute()
  // Full path: load → verify → simulate → atomicWrite.
  // Persists on success. Returns original listing on any failure.
  // -------------------------------------------------------------------------

  execute(
    listingId:   string,
    action:      StoreAction,
    params:      AdapterActionParams,
    econParams:  StoreEconomicParams,
    timestamp:   number = Date.now()
  ): SimAdapterResult {
    const { listing, errors } = this.loadAndVerify(listingId)
    if (!listing) return this.failResult(listingId, errors)

    const context   = this.buildContext(listing, params, timestamp)
    const result    = executeAction(listing, action, context, econParams)

    if (!result.ok) return { ok: false, listing, errors: result.errors }

    const writeErr  = this.atomicWrite(result, listing.version, action, timestamp)
    if (writeErr)   return { ok: false, listing, errors: [writeErr] }

    return { ok: true, listing: result.listing, errors: [] }
  }

  // -------------------------------------------------------------------------
  // simulate()
  // Phantom mode: identical to execute() but never persists.
  // Used to preview the outcome of a transition before committing.
  // -------------------------------------------------------------------------

  simulate(
    listingId:   string,
    action:      StoreAction,
    params:      AdapterActionParams,
    econParams:  StoreEconomicParams,
    timestamp:   number = Date.now()
  ): SimAdapterResult {
    const { listing, errors } = this.loadAndVerify(listingId)
    if (!listing) return this.failResult(listingId, errors)

    const context  = this.buildContext(listing, params, timestamp)
    const result   = executeAction(listing, action, context, econParams)

    // Never write — return result as-is
    return {
      ok:      result.ok,
      listing: result.ok ? result.listing : listing,
      errors:  result.errors
    }
  }

  // -------------------------------------------------------------------------
  // Private: loadAndVerify()
  // Loads a listing and runs the two adapter boundary integrity checks.
  //   1. guardReceiptCount — detects truncation or injection
  //   2. verifyReceiptChain — detects hash tampering
  // Both must pass before the listing is eligible for a transition.
  // -------------------------------------------------------------------------

  private loadAndVerify(
    listingId: string
  ): { listing: Listing | null; errors: string[] } {
    const listing = this.store.get(listingId)

    if (!listing)
      return { listing: null, errors: [`Listing '${listingId}' not found in store.`] }

    const countErr = guardReceiptCount(listing)
    if (countErr)
      return { listing: null, errors: [countErr] }

    const chainResult = verifyReceiptChain(listing)
    if (!chainResult.valid)
      return {
        listing: null,
        errors:  [
          `Receipt chain integrity failure at index ${chainResult.brokenAtIndex}: ${chainResult.error}`
        ]
      }

    return { listing, errors: [] }
  }

  // -------------------------------------------------------------------------
  // Private: buildContext()
  // Assembles the ActionContext for executeAction().
  // Computes previousHash from the last receipt in the chain — the engine
  // never does this itself (Engine Invariant Contract Rule 5).
  // -------------------------------------------------------------------------

  private buildContext(
    listing:   Listing,
    params:    AdapterActionParams,
    timestamp: number
  ): ActionContext {
    const previousHash = listing.receipts.length === 0
      ? "genesis"
      : listing.receipts[listing.receipts.length - 1]!.receiptHash
 
  return {
    actorId:         params.actorId,
    timestamp,
    expectedVersion: listing.version,
    isSystemContext: params.isSystemContext,
    previousHash,

    ...(params.escrowTxId !== undefined
        ? { escrowTxId: params.escrowTxId }
        : {}),

    ...(params.deliveryProofHash !== undefined
        ? { deliveryProofHash: params.deliveryProofHash }
        : {}),

    ...(params.evidenceValid !== undefined
        ? { evidenceValid: params.evidenceValid }
        : {})
}
  }

  // -------------------------------------------------------------------------
  // Private: atomicWrite()
  // Version lock check + full persistence in one logical operation.
  //
  // Version lock: the stored version must still match the version that was
  // loaded before executeAction was called. If it has changed, a concurrent
  // write has occurred — abort and require caller to reload and retry.
  //
  // Post-write integrity: guardReceiptCount is run on the new listing before
  // committing to the store. This catches any engine defect that would
  // produce a malformed aggregate on success.
  //
  // Returns null on success, or an error string on failure.
  // -------------------------------------------------------------------------

  private atomicWrite(
    result:        ActionResult,
    loadedVersion: number,
    action:        StoreAction,
    timestamp:     number
  ): string | null {
    const stored = this.store.get(result.listing.id)
    if (!stored)
      return `Listing '${result.listing.id}' disappeared before write.`

    // Version lock — reject if a concurrent write has occurred
    if (stored.version !== loadedVersion)
      return `Version conflict: stored version is ${stored.version}, loaded version was ${loadedVersion}. Reload and retry.`

    // Post-write integrity check before committing
    const countErr = guardReceiptCount(result.listing)
    if (countErr) return countErr

    // Commit
    this.store.set(result.listing.id, result.listing)

    // Record reputation deltas (pass base deltas to Reputation Engine as-is —
    // velocity scaling is applied externally, never here)
    if (result.deltas.sellerDelta !== 0 || result.deltas.buyerDelta !== 0) {
      this.reputationLog.push({
        listingId:   result.listing.id,
        action,
        timestamp,
        sellerDelta: result.deltas.sellerDelta,
        buyerDelta:  result.deltas.buyerDelta,
        sellerId:    result.listing.sellerId,
        buyerId:     result.listing.buyerId
      })
    }

    return null
  }

  // -------------------------------------------------------------------------
  // Private: failResult()
  // Returns a failure result when the listing cannot be loaded.
  // Falls back to the raw store entry if available (may be undefined).
  // -------------------------------------------------------------------------

  private failResult(listingId: string, errors: string[]): SimAdapterResult {
    const raw = this.store.get(listingId)
    return {
      ok:      false,
      listing: raw as Listing, // caller must check ok before using
      errors
    }
  }
}
