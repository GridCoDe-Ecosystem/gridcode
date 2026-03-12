"use strict"

import {
  Listing,
  StoreState,
  ActorRole,
  StoreEconomicParams
} from "./types"

// ---------------------------------------------------------------------------
// Guard contract: every guard returns null on pass, or an error string on fail.
// No side effects. No mutations. Pure functions only.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DISPATCHER GUARD 1
// Rejects if the caller's expectedVersion does not match listing.version.
// Prevents double-purchase race conditions and stale-aggregate replays.
// ---------------------------------------------------------------------------

export function guardVersionLock(
  listing: Listing,
  expectedVersion: number
): string | null {
  if (listing.version !== expectedVersion)
    return `Version mismatch: listing version ${listing.version}, expected ${expectedVersion}.`
  return null
}

// ---------------------------------------------------------------------------
// DISPATCHER GUARD 2
// Rejects all actions once settlementFinalized = true.
// Enforces terminal state immutability — no transitions after settlement.
// ---------------------------------------------------------------------------

export function guardTerminalLock(listing: Listing): string | null {
  if (listing.settlementFinalized)
    return "Settlement already finalized. No further transitions allowed."
  return null
}

// ---------------------------------------------------------------------------
// DISPATCHER GUARD 3
// Derives actor role from actorId matched against listing context.
// Role is NEVER accepted as an external input — always derived here.
//
// When buyerId === null (LISTED state), any non-seller is treated as a
// prospective buyer. Identity binding occurs inside applyPurchase on success.
// UNKNOWN only applies when buyerId is already assigned and actorId does not
// match either party — meaning the actor has no relationship to this listing.
// ---------------------------------------------------------------------------

export function deriveRole(
  actorId: string,
  listing: Listing,
  isSystemContext: boolean
): ActorRole {
  if (isSystemContext)                                              return "SYSTEM"
  if (actorId === listing.sellerId)                                return "SELLER"
  if (listing.buyerId !== null && actorId === listing.buyerId)     return "BUYER"
  // LISTED state: buyerId is null, any non-seller is a prospective buyer
  if (listing.buyerId === null)                                    return "BUYER"
  return "UNKNOWN"
}

// ---------------------------------------------------------------------------
// TRANSITION-LEVEL GUARDS
// Called inside individual transition functions, not the dispatcher directly.
// ---------------------------------------------------------------------------

// Rejects if the derived role does not match the required role for this action.
export function guardRole(
  derivedRole: ActorRole,
  requiredRole: ActorRole
): string | null {
  if (derivedRole !== requiredRole)
    return `Role mismatch: action requires ${requiredRole}, actor is ${derivedRole}.`
  return null
}

// Rejects if the listing is not in one of the required states for this action.
export function guardState(
  currentState: StoreState,
  requiredStates: StoreState[]
): string | null {
  if (!requiredStates.includes(currentState))
    return `Invalid state: action not permitted in ${currentState}.`
  return null
}

// Rejects if the listing price is below the protocol minimum (anti-farming floor).
export function guardMinPrice(
  price: number,
  params: StoreEconomicParams
): string | null {
  if (price < params.minListingPriceGNC)
    return `Price ${price} GNC is below the minimum allowed (${params.minListingPriceGNC} GNC).`
  return null
}

// Rejects dispute if the settlement window has already closed.
// IMPORTANT: passes when settlementDeadline is null — this handles
// the PURCHASED state where FULFILL has not yet set the deadline.
export function guardDisputeWindow(
  timestamp: number,
  settlementDeadline: number | null
): string | null {
  if (settlementDeadline !== null && timestamp >= settlementDeadline)
    return "Dispute window has closed. Settlement deadline has passed."
  return null
}

// Rejects FINALIZE_SETTLEMENT if the dispute window has not yet closed.
// Timestamp must be >= settlementDeadline before finalization is allowed.
export function guardFinalizationWindow(
  timestamp: number,
  settlementDeadline: number | null
): string | null {
  if (settlementDeadline === null)
    return "Finalization not permitted: settlement deadline has not been set."
  if (timestamp < settlementDeadline)
    return `Finalization window not yet reached. Deadline: ${settlementDeadline}, current: ${timestamp}.`
  return null
}

// Rejects if a dispute record is already active on this listing.
// Enforces the single active dispute invariant.
export function guardNoActiveDispute(listing: Listing): string | null {
  if (listing.disputeRecord !== null)
    return "A dispute is already active on this listing."
  return null
}

// ---------------------------------------------------------------------------
// ADAPTER BOUNDARY GUARD
// Not called inside the dispatcher. Called by the Adapter on every load.
// Detects silent receipt deletion or injection by verifying the
// receiptCount field matches the actual receipts array length.
// ---------------------------------------------------------------------------

export function guardReceiptCount(listing: Listing): string | null {
  if (listing.receiptCount !== listing.receipts.length)
    return `Receipt count mismatch: stored count is ${listing.receiptCount}, actual receipts: ${listing.receipts.length}.`
  return null
}
