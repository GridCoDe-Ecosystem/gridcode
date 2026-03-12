"use strict"

// ---------------------------------------------------------------------------
// StoreVault.ts
// The single entry point for the StoreVault engine.
// executeAction() is the ONLY exported function from this file.
// No transition function is ever called directly from outside the engine.
// No time fetching. No async. No IO. Pure deterministic FSM.
// ---------------------------------------------------------------------------

import {
  Listing,
  ActionContext,
  StoreAction,
  StoreState,
  StoreEconomicParams
} from "./types"

import {
  guardVersionLock,
  guardTerminalLock,
  deriveRole
} from "./guards"

import {
  TransitionResult,
  ReputationDeltas,
  applyPurchase,
  applyCancel,
  applyFulfill,
  applyRaiseDispute,
  applyResolveSeller,
  applyResolveBuyer,
  applyFinalizeSettlement
} from "./transitions"

// ---------------------------------------------------------------------------
// ActionResult — the public return type of executeAction().
// Consumers (Adapter layer) interact only with this shape.
// ---------------------------------------------------------------------------

export interface ActionResult {
  ok:      boolean
  listing: Listing
  deltas:  ReputationDeltas
  errors:  string[]
}

// ---------------------------------------------------------------------------
// Shared empty deltas constant.
// Used for all failed transitions and non-delta-emitting actions.
// ---------------------------------------------------------------------------

const EMPTY_DELTAS: ReputationDeltas = { sellerDelta: 0, buyerDelta: 0 }

// ---------------------------------------------------------------------------
// State-field consistency check.
// Rejects corrupted aggregates before any transition logic runs (AT-7).
// A listing where state = DISPUTED but disputeRecord = null is internally
// contradictory and must never be evolved further.
// ---------------------------------------------------------------------------

function validateAggregateConsistency(listing: Listing): string | null {
  if (listing.state === StoreState.DISPUTED && listing.disputeRecord === null)
    return "Corrupted aggregate: state is DISPUTED but disputeRecord is null."
  if (listing.state !== StoreState.DISPUTED && listing.disputeRecord !== null)
    return "Corrupted aggregate: disputeRecord is set but state is not DISPUTED."
  return null
}

// ---------------------------------------------------------------------------
// executeAction()
// The sole exported function. Called by the Adapter on every state transition.
//
// Dispatcher guard order (mandatory, must not be reordered):
//   1. guardVersionLock    — rejects stale aggregates
//   2. guardTerminalLock   — rejects post-settlement actions
//   3. validateConsistency — rejects corrupted aggregates
//   4. deriveRole          — resolves actorId to role (never accepted as input)
//   5. UNKNOWN role check  — rejects unrecognised actors
//   6. Resolution routing  — normalises RESOLVE_* by evidenceValid, not label
//   7. Action routing      — delegates to transition function
//
// On any guard failure: returns original listing unchanged, no deltas,
// no receipt. No partial transitions. No silent failures.
// ---------------------------------------------------------------------------

export function executeAction(
  listing:  Listing,
  action:   StoreAction,
  context:  ActionContext,
  params:   StoreEconomicParams
): ActionResult {

  // Step 1 — Version lock
  const versionErr = guardVersionLock(listing, context.expectedVersion)
  if (versionErr) return { ok: false, listing, deltas: EMPTY_DELTAS, errors: [versionErr] }

  // Step 2 — Terminal lock
  const terminalErr = guardTerminalLock(listing)
  if (terminalErr) return { ok: false, listing, deltas: EMPTY_DELTAS, errors: [terminalErr] }

  // Step 3 — Aggregate consistency
  const consistencyErr = validateAggregateConsistency(listing)
  if (consistencyErr) return { ok: false, listing, deltas: EMPTY_DELTAS, errors: [consistencyErr] }

  // Step 4 — Derive role (never trusted from outside)
  const role = deriveRole(context.actorId, listing, context.isSystemContext)

  // Step 5 — Reject unknown actors immediately
  if (role === "UNKNOWN")
    return { ok: false, listing, deltas: EMPTY_DELTAS, errors: ["Actor identity could not be resolved."] }

  // Step 6 — Resolution routing normalisation.
  // The dispatcher does not trust the action label for RESOLVE_* actions.
  // evidenceValid determines the outcome — not what the caller asserts.
  let resolvedAction = action
  if (
    action === StoreAction.RESOLVE_SELLER ||
    action === StoreAction.RESOLVE_BUYER
  ) {
    resolvedAction = context.evidenceValid === true
      ? StoreAction.RESOLVE_SELLER
      : StoreAction.RESOLVE_BUYER
  }

  // Step 7 — Route to transition function
  let result: TransitionResult

  switch (resolvedAction) {
    case StoreAction.PURCHASE:
      result = applyPurchase(listing, role, context, params)
      break

    case StoreAction.CANCEL:
      result = applyCancel(listing, role, context)
      break

    case StoreAction.FULFILL:
      result = applyFulfill(listing, role, context, params)
      break

    case StoreAction.RAISE_DISPUTE:
      result = applyRaiseDispute(listing, role, context)
      break

    case StoreAction.RESOLVE_SELLER:
      result = applyResolveSeller(listing, role, context)
      break

    case StoreAction.RESOLVE_BUYER:
      result = applyResolveBuyer(listing, role, context)
      break

    case StoreAction.FINALIZE_SETTLEMENT:
      result = applyFinalizeSettlement(listing, role, context)
      break

    default:
      // Exhaustive switch — this branch is unreachable if StoreAction is complete.
      // TypeScript will warn if a new action is added without a handler.
      return {
        ok:      false,
        listing,
        deltas:  EMPTY_DELTAS,
        errors:  [`Unknown action: ${action}`]
      }
  }

  return result
}
