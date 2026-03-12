"use strict"

// ---------------------------------------------------------------------------
// State & Action Enums
// ---------------------------------------------------------------------------

export enum StoreState {
  LISTED     = "LISTED",
  PURCHASED  = "PURCHASED",
  FULFILLED  = "FULFILLED",
  DISPUTED   = "DISPUTED",
  CANCELLED  = "CANCELLED"
}

export enum StoreAction {
  PURCHASE            = "PURCHASE",
  CANCEL              = "CANCEL",
  FULFILL             = "FULFILL",
  RAISE_DISPUTE       = "RAISE_DISPUTE",
  FINALIZE_SETTLEMENT = "FINALIZE_SETTLEMENT",
  RESOLVE_SELLER      = "RESOLVE_SELLER",
  RESOLVE_BUYER       = "RESOLVE_BUYER"
}

export enum ReceiptState {
  PENDING          = "PENDING",
  PRECONFIRMED     = "PRECONFIRMED",
  CONFIRMED        = "CONFIRMED",
  FAILED           = "FAILED",
  DISPUTED_FLAGGED = "DISPUTED_FLAGGED"
}

// ---------------------------------------------------------------------------
// Actor Role
// Derived internally by the engine from actorId. Never accepted as input.
// ---------------------------------------------------------------------------

export type ActorRole =
  | "SELLER"
  | "BUYER"
  | "SYSTEM"
  | "UNKNOWN"

// ---------------------------------------------------------------------------
// Receipt
// Every valid state transition produces exactly one receipt (receipt-state
// mirror guarantee). fromState and toState are mandatory per Protocol §11.10.
// ---------------------------------------------------------------------------

export interface Receipt {
  receiptId:     string
  listingId:     string
  action:        StoreAction
  fromState:     StoreState
  toState:       StoreState
  receiptState:  ReceiptState
  actor:         string
  timestamp:     number
  previousHash:  string
  receiptHash:  string
}

// ---------------------------------------------------------------------------
// Dispute Record
// At most one active dispute may exist per listing at any time.
// ---------------------------------------------------------------------------

export interface DisputeRecord {
  receiptId:          string            // receipt that triggered the dispute
  raisedBy:           string
  timestamp:          number
  evidenceSubmitted:  boolean
  evidenceMetadata?:  Record<string, unknown>
  resolutionDeadline: number
  resolved:           boolean
  overrideApplied?:   boolean
  overrideReason?:    string
}

// ---------------------------------------------------------------------------
// Listing (ListingAggregate)
// Immutable aggregate root. All transitions return a new instance via spread.
// version increments by 1 on every successful transition.
// receiptCount must always equal receipts.length (enforced by guardReceiptCount).
// ---------------------------------------------------------------------------

export interface Listing {
  id:                   string
  sellerId:             string
  buyerId:              string | null
  price:                number

  state:                StoreState
  version:              number
  receiptCount:         number

  escrowTxId:           string | null
  purchaseTxId:         string | null

  settlementDeadline:   number | null
  settlementFinalized:  boolean

  deliveryProofHash:    string | null
  disputeRecord:        DisputeRecord | null

  receipts:             Receipt[]
}

// ---------------------------------------------------------------------------
// Economic Parameters
// Injected by the Adapter from governance-controlled config.
// The engine never hardcodes durations or thresholds.
// ---------------------------------------------------------------------------

export interface StoreEconomicParams {
  minListingPriceGNC:   number   // Minimum listing price (anti-farming floor)
  fulfillmentWindowMs:  number   // Window for seller to fulfill after purchase
  disputeWindowMs:      number   // Window for buyer to raise dispute after fulfill
}

// ---------------------------------------------------------------------------
// Action Context
// Injected by the Adapter on every executeAction() call.
// role is NOT a field here — it is derived internally from actorId.
// evidenceValid drives resolution routing; the engine never trusts the
// action label alone for RESOLVE_SELLER / RESOLVE_BUYER.
// ---------------------------------------------------------------------------

export interface ActionContext {
  actorId:          string
  timestamp:        number   // Injected — engine must never call Date.now()
  expectedVersion:  number   // Version lock: must match listing.version
  isSystemContext:  boolean  // Flags SYSTEM role for governance actions
  escrowTxId?:      string   // Required for PURCHASE
  deliveryProofHash?: string // Required for FULFILL
  previousHash:     string   // Receipt chain: computed by Adapter, injected here
  evidenceValid?:   boolean  // Drives RESOLVE_SELLER vs RESOLVE_BUYER routing
}
