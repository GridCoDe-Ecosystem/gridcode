"use strict"

// ---------------------------------------------------------------------------
// transitions.ts
// Private transition functions. None of these are exported directly.
// All are called exclusively through executeAction() in StoreVault.ts.
// Each function returns a TransitionResult — never throws.
// Each successful transition returns a new listing via spread (no mutation).
// ---------------------------------------------------------------------------

import {
  Listing,
  ActionContext,
  StoreState,
  StoreAction,
  StoreEconomicParams,
  ActorRole,
  ReceiptState,
  DisputeRecord
} from "./types"

import {
  guardRole,
  guardState,
  guardMinPrice,
  guardDisputeWindow,
  guardFinalizationWindow,
  guardNoActiveDispute
} from "./guards"

import { buildReceipt } from "./receipts"

// ---------------------------------------------------------------------------
// TransitionResult — the return type of every transition function.
// ok: false always returns the original listing unchanged with no deltas.
// ---------------------------------------------------------------------------

export interface ReputationDeltas {
  sellerDelta: number
  buyerDelta:  number
}

export interface TransitionResult {
  ok:      boolean
  listing: Listing
  deltas:  ReputationDeltas
  errors:  string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_DELTAS: ReputationDeltas = { sellerDelta: 0, buyerDelta: 0 }

function fail(listing: Listing, ...errors: string[]): TransitionResult {
  return { ok: false, listing, deltas: EMPTY_DELTAS, errors }
}

function nextReceiptIndex(listing: Listing): number {
  return listing.receipts.length
}

// ---------------------------------------------------------------------------
// PURCHASE
// LISTED → PURCHASED
// Role: BUYER
// Requires: escrowTxId present and non-empty (AT-12)
// Requires: price >= minListingPriceGNC (anti-farming floor)
// Effects: buyerId set, escrowTxId stored, version+1, receiptCount+1
// ---------------------------------------------------------------------------

export function applyPurchase(
  listing: Listing,
  role: ActorRole,
  context: ActionContext,
  params: StoreEconomicParams
): TransitionResult {
  const roleErr  = guardRole(role, "BUYER")
  if (roleErr) return fail(listing, roleErr)

  const stateErr = guardState(listing.state, [StoreState.LISTED])
  if (stateErr) return fail(listing, stateErr)

  const priceErr = guardMinPrice(listing.price, params)
  if (priceErr) return fail(listing, priceErr)

  if (!context.escrowTxId)
    return fail(listing, "Escrow confirmation required.")

  const receipt = buildReceipt({
    listingId:    listing.id,
    action:       StoreAction.PURCHASE,
    fromState:    StoreState.LISTED,
    toState:      StoreState.PURCHASED,
    receiptState: ReceiptState.CONFIRMED,
    actor:        context.actorId,
    timestamp:    context.timestamp,
    previousHash: context.previousHash,
    receiptIndex: nextReceiptIndex(listing)
  })

  const updated: Listing = {
    ...listing,
    state:        StoreState.PURCHASED,
    buyerId:      context.actorId,
    escrowTxId:   context.escrowTxId,
    version:      listing.version + 1,
    receiptCount: listing.receiptCount + 1,
    receipts:     [...listing.receipts, receipt]
  }

  return { ok: true, listing: updated, deltas: EMPTY_DELTAS, errors: [] }
}

// ---------------------------------------------------------------------------
// CANCEL
// LISTED → CANCELLED
// Role: SELLER
// Effects: terminal state, version+1, receiptCount+1
// No deltas emitted.
// ---------------------------------------------------------------------------

export function applyCancel(
  listing: Listing,
  role: ActorRole,
  context: ActionContext
): TransitionResult {
  const roleErr  = guardRole(role, "SELLER")
  if (roleErr) return fail(listing, roleErr)

  const stateErr = guardState(listing.state, [StoreState.LISTED])
  if (stateErr) return fail(listing, stateErr)

  const receipt = buildReceipt({
    listingId:    listing.id,
    action:       StoreAction.CANCEL,
    fromState:    StoreState.LISTED,
    toState:      StoreState.CANCELLED,
    receiptState: ReceiptState.CONFIRMED,
    actor:        context.actorId,
    timestamp:    context.timestamp,
    previousHash: context.previousHash,
    receiptIndex: nextReceiptIndex(listing)
  })

  const updated: Listing = {
    ...listing,
    state:        StoreState.CANCELLED,
    version:      listing.version + 1,
    receiptCount: listing.receiptCount + 1,
    receipts:     [...listing.receipts, receipt]
  }

  return { ok: true, listing: updated, deltas: EMPTY_DELTAS, errors: [] }
}

// ---------------------------------------------------------------------------
// FULFILL
// PURCHASED → FULFILLED
// Role: SELLER
// Requires: deliveryProofHash present and non-empty (AT-5)
// Effects: deliveryProofHash stored, settlementDeadline set,
//          settlementFinalized = false, version+1, receiptCount+1
// No deltas yet — emitted only on FINALIZE_SETTLEMENT.
// ---------------------------------------------------------------------------

export function applyFulfill(
  listing: Listing,
  role: ActorRole,
  context: ActionContext,
  params: StoreEconomicParams
): TransitionResult {
  const roleErr  = guardRole(role, "SELLER")
  if (roleErr) return fail(listing, roleErr)

  const stateErr = guardState(listing.state, [StoreState.PURCHASED])
  if (stateErr) return fail(listing, stateErr)

  if (!context.deliveryProofHash)
    return fail(listing, "Delivery proof hash is required to fulfill.")

  const settlementDeadline = context.timestamp + params.disputeWindowMs

  const receipt = buildReceipt({
    listingId:    listing.id,
    action:       StoreAction.FULFILL,
    fromState:    StoreState.PURCHASED,
    toState:      StoreState.FULFILLED,
    receiptState: ReceiptState.CONFIRMED,
    actor:        context.actorId,
    timestamp:    context.timestamp,
    previousHash: context.previousHash,
    receiptIndex: nextReceiptIndex(listing)
  })

  const updated: Listing = {
    ...listing,
    state:               StoreState.FULFILLED,
    deliveryProofHash:   context.deliveryProofHash,
    settlementDeadline,
    settlementFinalized: false,
    version:             listing.version + 1,
    receiptCount:        listing.receiptCount + 1,
    receipts:            [...listing.receipts, receipt]
  }

  return { ok: true, listing: updated, deltas: EMPTY_DELTAS, errors: [] }
}

// ---------------------------------------------------------------------------
// RAISE_DISPUTE
// PURCHASED | FULFILLED → DISPUTED
// Role: BUYER
// Requires: no active dispute (single dispute invariant)
// Requires: dispute window still open (guardDisputeWindow)
// Effects: disputeRecord created, receiptState → DISPUTED_FLAGGED,
//          version+1, receiptCount+1
// No deltas emitted.
// ---------------------------------------------------------------------------

export function applyRaiseDispute(
  listing: Listing,
  role: ActorRole,
  context: ActionContext
): TransitionResult {
  const roleErr  = guardRole(role, "BUYER")
  if (roleErr) return fail(listing, roleErr)

  const stateErr = guardState(listing.state, [
    StoreState.PURCHASED,
    StoreState.FULFILLED
  ])
  if (stateErr) return fail(listing, stateErr)

  const disputeErr = guardNoActiveDispute(listing)
  if (disputeErr) return fail(listing, disputeErr)

  const windowErr = guardDisputeWindow(context.timestamp, listing.settlementDeadline)
  if (windowErr) return fail(listing, windowErr)

  const disputeRecord: DisputeRecord = {
    receiptId:          `${listing.id}-dispute-${context.timestamp}`,
    raisedBy:           context.actorId,
    timestamp:          context.timestamp,
    evidenceSubmitted:  false,
    resolutionDeadline: listing.settlementDeadline ?? (context.timestamp + 86400000),
    resolved:           false
  }

  const receipt = buildReceipt({
    listingId:    listing.id,
    action:       StoreAction.RAISE_DISPUTE,
    fromState:    listing.state,
    toState:      StoreState.DISPUTED,
    receiptState: ReceiptState.DISPUTED_FLAGGED,
    actor:        context.actorId,
    timestamp:    context.timestamp,
    previousHash: context.previousHash,
    receiptIndex: nextReceiptIndex(listing)
  })

  const updated: Listing = {
    ...listing,
    state:        StoreState.DISPUTED,
    disputeRecord,
    version:      listing.version + 1,
    receiptCount: listing.receiptCount + 1,
    receipts:     [...listing.receipts, receipt]
  }

  return { ok: true, listing: updated, deltas: EMPTY_DELTAS, errors: [] }
}

// ---------------------------------------------------------------------------
// RESOLVE_SELLER
// DISPUTED → FULFILLED (terminal)
// Role: SYSTEM
// Routing: only reached when evidenceValid = true (enforced in dispatcher)
// Effects: settlementFinalized = true, disputeRecord resolved,
//          version+1, receiptCount+1
// Deltas: seller +1, buyer -2 (frivolous dispute penalty)
// ---------------------------------------------------------------------------

export function applyResolveSeller(
  listing: Listing,
  role: ActorRole,
  context: ActionContext
): TransitionResult {
  const roleErr  = guardRole(role, "SYSTEM")
  if (roleErr) return fail(listing, roleErr)

  const stateErr = guardState(listing.state, [StoreState.DISPUTED])
  if (stateErr) return fail(listing, stateErr)

  const receipt = buildReceipt({
    listingId:    listing.id,
    action:       StoreAction.RESOLVE_SELLER,
    fromState:    StoreState.DISPUTED,
    toState:      StoreState.FULFILLED,
    receiptState: ReceiptState.CONFIRMED,
    actor:        context.actorId,
    timestamp:    context.timestamp,
    previousHash: context.previousHash,
    receiptIndex: nextReceiptIndex(listing)
  })

  const updated: Listing = {
    ...listing,
    state:               StoreState.FULFILLED,
    settlementFinalized: true,
    disputeRecord:       listing.disputeRecord
      ? { ...listing.disputeRecord, resolved: true }
      : null,
    version:             listing.version + 1,
    receiptCount:        listing.receiptCount + 1,
    receipts:            [...listing.receipts, receipt]
  }

  return {
    ok:      true,
    listing: updated,
    deltas:  { sellerDelta: 1, buyerDelta: -2 },
    errors:  []
  }
}

// ---------------------------------------------------------------------------
// RESOLVE_BUYER
// DISPUTED → CANCELLED (terminal)
// Role: SYSTEM
// Routing: only reached when evidenceValid = false (enforced in dispatcher)
// Effects: settlementFinalized = true, disputeRecord resolved,
//          version+1, receiptCount+1
// Deltas: seller -4 (major fault), buyer +1
// ---------------------------------------------------------------------------

export function applyResolveBuyer(
  listing: Listing,
  role: ActorRole,
  context: ActionContext
): TransitionResult {
  const roleErr  = guardRole(role, "SYSTEM")
  if (roleErr) return fail(listing, roleErr)

  const stateErr = guardState(listing.state, [StoreState.DISPUTED])
  if (stateErr) return fail(listing, stateErr)

  const receipt = buildReceipt({
    listingId:    listing.id,
    action:       StoreAction.RESOLVE_BUYER,
    fromState:    StoreState.DISPUTED,
    toState:      StoreState.CANCELLED,
    receiptState: ReceiptState.CONFIRMED,
    actor:        context.actorId,
    timestamp:    context.timestamp,
    previousHash: context.previousHash,
    receiptIndex: nextReceiptIndex(listing)
  })

  const updated: Listing = {
    ...listing,
    state:               StoreState.CANCELLED,
    settlementFinalized: true,
    disputeRecord:       listing.disputeRecord
      ? { ...listing.disputeRecord, resolved: true }
      : null,
    version:             listing.version + 1,
    receiptCount:        listing.receiptCount + 1,
    receipts:            [...listing.receipts, receipt]
  }

  return {
    ok:      true,
    listing: updated,
    deltas:  { sellerDelta: -4, buyerDelta: 1 },
    errors:  []
  }
}

// ---------------------------------------------------------------------------
// FINALIZE_SETTLEMENT
// FULFILLED → FULFILLED (terminal)
// Role: SYSTEM
// Requires: timestamp >= settlementDeadline (dispute window closed)
// Requires: no active dispute
// Effects: settlementFinalized = true, version+1, receiptCount+1
// Deltas: seller +2, buyer +1 (clean completion)
// ---------------------------------------------------------------------------

export function applyFinalizeSettlement(
  listing: Listing,
  role: ActorRole,
  context: ActionContext
): TransitionResult {
  const roleErr  = guardRole(role, "SYSTEM")
  if (roleErr) return fail(listing, roleErr)

  const stateErr = guardState(listing.state, [StoreState.FULFILLED])
  if (stateErr) return fail(listing, stateErr)

  const windowErr = guardFinalizationWindow(context.timestamp, listing.settlementDeadline)
  if (windowErr) return fail(listing, windowErr)

  const disputeErr = guardNoActiveDispute(listing)
  if (disputeErr) return fail(listing, disputeErr)

  const receipt = buildReceipt({
    listingId:    listing.id,
    action:       StoreAction.FINALIZE_SETTLEMENT,
    fromState:    StoreState.FULFILLED,
    toState:      StoreState.FULFILLED,
    receiptState: ReceiptState.CONFIRMED,
    actor:        context.actorId,
    timestamp:    context.timestamp,
    previousHash: context.previousHash,
    receiptIndex: nextReceiptIndex(listing)
  })

  const updated: Listing = {
    ...listing,
    settlementFinalized: true,
    version:             listing.version + 1,
    receiptCount:        listing.receiptCount + 1,
    receipts:            [...listing.receipts, receipt]
  }

  return {
    ok:      true,
    listing: updated,
    deltas:  { sellerDelta: 2, buyerDelta: 1 },
    errors:  []
  }
}
