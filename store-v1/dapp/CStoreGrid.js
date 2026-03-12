"use strict"

// ---------------------------------------------------------------------------
// CStoreGrid.js — GridCoDe Store v1 dApp
//
// Extends CWindow. Handles the full Store lifecycle for both seller and
// buyer roles. Phantom mode simulation runs before every TX. The engine
// (pure function) is bundled via Rollup — no OS dependency inside it.
//
// Execution flow per action:
//   1. User clicks action
//   2. Engine called with current listing state → phantom result
//   3. Preview panel shown — user confirms or cancels
//   4. On confirm: GridScript BT → write listing.ber → CT
//   5. CT generates QR → user scans on mobile app → broadcasts
//   6. newVMMetaDataCallback fires on confirmation
//   7. Reload listing from DFS → update UI
//
// Deployment: bundle with Rollup (exclude /lib/*), rename .js → .app
// ---------------------------------------------------------------------------

import { CWindow }                          from "/lib/window.js"
import { CVMMetaGenerator, CVMMetaParser }  from "/lib/MetaData.js"
import { CAppSettings }                     from "/lib/SettingsManager.js"
import { GridScriptCompiler }               from "/lib/GridScriptCompiler.js"

// Engine — bundled (not a system lib)
import { executeAction }     from "../engine/StoreVault.js"
import { guardReceiptCount } from "../engine/guards.js"
import { verifyReceiptChain } from "../engine/receipts.js"
import { StoreAction, StoreState } from "../engine/types.js"

// ---------------------------------------------------------------------------
// Private WeakMap — sensitive per-instance state
// ---------------------------------------------------------------------------

const _private = new WeakMap()

// ---------------------------------------------------------------------------
// Economic parameters — canonical v1 values
// ---------------------------------------------------------------------------

const ECON_PARAMS = {
  minListingPriceGNC:  10,
  fulfillmentWindowMs: 172800000,
  disputeWindowMs:     86400000
}

// ---------------------------------------------------------------------------
// State-Domain paths
// ---------------------------------------------------------------------------

const listingPath = id => `/store/listings/${id}.ber`

// ---------------------------------------------------------------------------
// Shadow DOM body
// ---------------------------------------------------------------------------

const body = `
<link rel="stylesheet" href="/css/windowDefault.css" />
<style>
  :host {
    --primary:  #22fafc;
    --accent:   #7b5ea7;
    --bg:       #0a0a14;
    --surface:  #111128;
    --border:   rgba(34, 250, 252, 0.18);
    --text:     #e0e0ff;
    --muted:    #888aaa;
    --ok:       #22fc88;
    --warn:     #fcb822;
    --danger:   #fc4422;
  }

  .container {
    position: absolute; top: 0; left: 0;
    height: 100%; width: 100%;
    background: var(--bg);
    display: flex; flex-direction: column;
    overflow: hidden;
    font-family: 'Rajdhani', sans-serif;
    color: var(--text);
  }

  /* ── Header ─────────────────────────────── */
  .header {
    flex-shrink: 0;
    background: linear-gradient(90deg, #090918, #141432);
    border-bottom: 1px solid var(--primary);
    padding: 10px 20px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .header-title  { font-size: 1.1em; font-weight: 600; color: var(--primary); }
  .header-role   { font-size: 0.8em; color: var(--muted); }

  /* ── Scroll content ──────────────────────── */
  .content {
    flex: 1; overflow-y: auto; padding: 20px;
    display: flex; flex-direction: column; gap: 16px;
  }

  /* ── Listing card ────────────────────────── */
  .listing-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 16px;
  }
  .listing-title   { font-size: 1.2em; font-weight: 700; margin-bottom: 4px; }
  .listing-price   { color: var(--primary); font-size: 1.4em; font-weight: 700; }
  .listing-seller  { color: var(--muted); font-size: 0.85em; margin-top: 4px; }
  .listing-state   {
    display: inline-block;
    font-size: 0.75em; font-weight: 700; letter-spacing: 0.08em;
    padding: 2px 8px; border-radius: 3px; margin-top: 8px;
    background: rgba(34,250,252,0.1); color: var(--primary); border: 1px solid var(--primary);
  }
  .listing-state.CANCELLED, .listing-state.DISPUTED {
    background: rgba(252,68,34,0.1); color: var(--danger); border-color: var(--danger);
  }
  .listing-state.FULFILLED {
    background: rgba(34,252,136,0.1); color: var(--ok); border-color: var(--ok);
  }
  .listing-state.PURCHASED {
    background: rgba(252,184,34,0.1); color: var(--warn); border-color: var(--warn);
  }

  /* ── Action panel ────────────────────────── */
  .action-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .action-panel-title { font-size: 0.85em; color: var(--muted); margin-bottom: 4px; }

  /* ── Buttons ─────────────────────────────── */
  .btn {
    padding: 10px 18px; border-radius: 4px; border: none;
    font-family: inherit; font-size: 0.95em; font-weight: 600;
    cursor: pointer; letter-spacing: 0.04em; transition: opacity 0.15s;
  }
  .btn:disabled  { opacity: 0.35; cursor: not-allowed; }
  .btn:hover:not(:disabled) { opacity: 0.85; }
  .btn-primary   { background: var(--primary); color: #0a0a14; }
  .btn-danger    { background: var(--danger);  color: #fff; }
  .btn-muted     { background: transparent; color: var(--muted); border: 1px solid var(--border); }

  /* ── Phantom preview ─────────────────────── */
  .phantom-panel {
    background: rgba(123,94,167,0.12);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 14px;
    display: none; flex-direction: column; gap: 8px;
  }
  .phantom-panel.visible { display: flex; }
  .phantom-title  { color: var(--accent); font-size: 0.85em; font-weight: 700; letter-spacing: 0.06em; }
  .phantom-row    { display: flex; justify-content: space-between; font-size: 0.9em; }
  .phantom-key    { color: var(--muted); }
  .phantom-val    { color: var(--text); font-weight: 600; }
  .phantom-ok     { color: var(--ok); }
  .phantom-fail   { color: var(--danger); }
  .phantom-actions { display: flex; gap: 10px; margin-top: 6px; }

  /* ── Receipt chain ───────────────────────── */
  .receipt-list { display: flex; flex-direction: column; gap: 6px; }
  .receipt-item {
    background: rgba(34,250,252,0.04);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 0.8em;
  }
  .receipt-transition { color: var(--primary); font-weight: 700; }
  .receipt-actor      { color: var(--muted); }
  .receipt-hash       { color: #555577; word-break: break-all; margin-top: 2px; }

  /* ── Status / error ──────────────────────── */
  .status-bar {
    flex-shrink: 0;
    padding: 8px 20px;
    font-size: 0.82em;
    border-top: 1px solid var(--border);
    color: var(--muted);
    min-height: 32px;
  }
  .status-bar.error   { color: var(--danger); }
  .status-bar.success { color: var(--ok); }
  .status-bar.pending { color: var(--warn); }

  /* ── Loading ─────────────────────────────── */
  .loading { text-align: center; padding: 40px; color: var(--muted); }

  /* ── Responsive ──────────────────────────── */
  .container.narrow .listing-price  { font-size: 1.1em; }
  .container.narrow .content        { padding: 12px; }
</style>

<div class="container" id="root">
  <div class="header">
    <span class="header-title" id="header-title">GridCoDe Store</span>
    <span class="header-role"  id="header-role"></span>
  </div>

  <div class="content" id="content">
    <div class="loading" id="loading">Loading listing…</div>

    <!-- Listing card -->
    <div class="listing-card" id="listing-card" style="display:none">
      <div class="listing-title"  id="listing-title">—</div>
      <div class="listing-price"  id="listing-price">—</div>
      <div class="listing-seller" id="listing-seller">—</div>
      <span class="listing-state" id="listing-state">—</span>
    </div>

    <!-- Action panel -->
    <div class="action-panel" id="action-panel" style="display:none">
      <div class="action-panel-title">AVAILABLE ACTIONS</div>
      <button class="btn btn-primary" id="btn-purchase"  style="display:none">Purchase</button>
      <button class="btn btn-muted"   id="btn-cancel"    style="display:none">Cancel Listing</button>
      <button class="btn btn-primary" id="btn-fulfill"   style="display:none">Mark Fulfilled</button>
      <button class="btn btn-danger"  id="btn-dispute"   style="display:none">Raise Dispute</button>
      <button class="btn btn-primary" id="btn-finalize"  style="display:none">Finalize Settlement</button>
    </div>

    <!-- Phantom mode preview panel -->
    <div class="phantom-panel" id="phantom-panel">
      <div class="phantom-title">⬡ PHANTOM MODE — SIMULATED OUTCOME</div>
      <div class="phantom-row">
        <span class="phantom-key">Action</span>
        <span class="phantom-val" id="phantom-action">—</span>
      </div>
      <div class="phantom-row">
        <span class="phantom-key">State after</span>
        <span class="phantom-val" id="phantom-state">—</span>
      </div>
      <div class="phantom-row">
        <span class="phantom-key">Reputation ∆ seller</span>
        <span class="phantom-val" id="phantom-seller-delta">—</span>
      </div>
      <div class="phantom-row">
        <span class="phantom-key">Reputation ∆ buyer</span>
        <span class="phantom-val" id="phantom-buyer-delta">—</span>
      </div>
      <div class="phantom-row">
        <span class="phantom-key">Simulation result</span>
        <span class="phantom-val" id="phantom-result">—</span>
      </div>
      <div class="phantom-actions">
        <button class="btn btn-primary" id="btn-confirm-tx">Confirm &amp; Sign</button>
        <button class="btn btn-muted"   id="btn-cancel-tx">Cancel</button>
      </div>
    </div>

    <!-- Receipt chain -->
    <div class="action-panel" id="receipt-section" style="display:none">
      <div class="action-panel-title">RECEIPT CHAIN</div>
      <div class="receipt-list" id="receipt-list"></div>
    </div>
  </div>

  <div class="status-bar" id="status-bar">Ready.</div>
</div>
`

// ---------------------------------------------------------------------------
// CStoreGrid
// ---------------------------------------------------------------------------

class CStoreGrid extends CWindow {

  constructor (positionX, positionY, width, height, data, dataType, filePath, thread) {
    super(
      positionX, positionY, width, height,
      body, "GridCoDe Store", CStoreGrid.getIcon(), true,
      data, dataType, filePath, thread
    )

    // Private sensitive state (WeakMap — Rule 4)
    _private.set(this, { pendingAction: null, pendingContext: null })

    // Instance state (this.* — Rule 1)
    this.mListing        = null   // current listing aggregate
    this.mListingId      = null   // resolved from deep link or data
    this.mRole           = null   // "SELLER" | "BUYER" | "UNKNOWN"
    this.mMetaParser     = new CVMMetaParser()
    this.mControler      = 0
    this.mControllerExecuting = false
    this.mPendingReqIds  = new Set()

    // Register CVMContext listeners — ALL in constructor (Rule 6, Rule 8)
    const vm = CVMContext.getInstance()
    vm.addNewDFSMsgListener(this.onDFSMsg.bind(this), this.mID)
    vm.addVMMetaDataListener(this.onMetaData.bind(this), this.mID)
    vm.addVMStateChangedListener(this.onStateChanged.bind(this), this.mID)
  }

  // ── Static metadata ─────────────────────────────────────────────────────

  static getPackageID ()       { return "org.gridnetproject.UIdApps.gridcode.storeGrid" }
  static getDefaultCategory () { return "dApps" }
  static getIcon ()            { return "" }
  static getFileHandlers ()    { return [] }

  static getSettings ()        { return CStoreGrid.sCurrentSettings }
  static setSettings (sets) {
    if (!(sets instanceof CAppSettings)) return false
    CStoreGrid.sCurrentSettings = sets
    return true
  }
  static getDefaultSettings () {
    return new CAppSettings(CStoreGrid.getPackageID(), { version: 1 })
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  open () {
    super.open()

    // Resolve listing ID from deep link data or constructor args
    // Deep link format: gridcode://listing/<listingId>
    this.mListingId = this.mData ?? null

    if (!this.mListingId) {
      this.setStatus("No listing ID provided. Open via deep link.", "error")
      return
    }

    // Start periodic refresh thread (30s interval)
    this.mControler = CVMContext.getInstance().createJSThread(
      this.controllerThread.bind(this),
      this.getProcessID,
      30000
    )

    this.loadListing()
  }

  closeWindow () {
    if (this.mControler > 0)
      CVMContext.getInstance().stopJSThread(this.mControler)
    CVMContext.getInstance().unregisterEventListenerByID(this.mID)
    _private.delete(this)
    super.closeWindow() // ALWAYS last (Rule 10)
  }

  // ── Periodic refresh ─────────────────────────────────────────────────────

  controllerThread () {
    if (this.mControllerExecuting) return false
    this.mControllerExecuting = true
    this.loadListing()
    this.mControllerExecuting = false
    return true
  }

  // ── DFS read — load listing ───────────────────────────────────────────────

  loadListing () {
    if (!this.mListingId) return
    const vm    = CVMContext.getInstance()
    const reqID = vm.genRequestID()
    this.addNetworkRequestID(reqID)
    this.mPendingReqIds.add(reqID)

    // Read listing.ber from seller's State-Domain
    // Domain is derived from listing ID prefix in production.
    // For v1, the listing encodes the seller domain in its path.
    vm.doGetFile(
      this.mSellerDomain ?? vm.getUserFullID(),
      listingPath(this.mListingId),
      reqID,
      this
    )
  }

  // ── CVMContext callbacks ──────────────────────────────────────────────────

  onDFSMsg (dfsMsg) {
    // Rule 9 — only handle our own requests
    if (!this.hasNetworkRequestID(dfsMsg.getReqID)) return
    this.mPendingReqIds.delete(dfsMsg.getReqID)

    if (!dfsMsg.getData1 || dfsMsg.getData1.byteLength === 0) {
      this.setStatus("Listing not found or empty response.", "error")
      this.getControl("loading").textContent = "Listing not found."
      return
    }

    try {
      const json    = new TextDecoder().decode(dfsMsg.getData1)
      const listing = JSON.parse(json)
      this.onListingLoaded(listing)
    } catch (err) {
      this.setStatus(`Failed to parse listing: ${err}`, "error")
    }
  }

  onMetaData (msg) {
    // Handles GridScript TX confirmation
    if (!this.hasNetworkRequestID(msg.getReqID)) return

    // TX confirmed — reload listing from DFS to get canonical state
    this.setStatus("Transaction confirmed. Reloading…", "success")
    setTimeout(() => this.loadListing(), 1500)
  }

  onStateChanged (eventData) {
    // Connection state changes — could show connectivity indicator
  }

  // ── Listing loaded ────────────────────────────────────────────────────────

  onListingLoaded (listing) {
    // Run adapter boundary integrity checks before touching state
    const countErr = guardReceiptCount(listing)
    if (countErr) {
      this.setStatus(`Integrity error: ${countErr}`, "error")
      return
    }
    const chainResult = verifyReceiptChain(listing)
    if (!chainResult.valid) {
      this.setStatus(`Chain integrity failure at index ${chainResult.brokenAtIndex}`, "error")
      return
    }

    this.mListing = listing
    this.mRole    = this.deriveRole(listing)

    this.renderListing(listing)
    this.renderActions(listing)
    this.renderReceipts(listing)
    this.setStatus("Listing loaded.")
  }

  // ── Role derivation ───────────────────────────────────────────────────────

  deriveRole (listing) {
    const myId = CVMContext.getInstance().getUserFullID()
    if (myId === listing.sellerId)  return "SELLER"
    if (myId === listing.buyerId)   return "BUYER"
    if (listing.buyerId === null)   return "PROSPECTIVE_BUYER"
    return "UNKNOWN"
  }

  // ── Render listing card ───────────────────────────────────────────────────

  renderListing (listing) {
    this.getControl("loading").style.display       = "none"
    this.getControl("listing-card").style.display  = "block"

    this.getControl("header-title").textContent  = `GridCoDe Store — ${listing.id}`
    this.getControl("header-role").textContent   = this.mRole
    this.getControl("listing-title").textContent = listing.id
    this.getControl("listing-price").textContent = `${listing.price} GNC`
    this.getControl("listing-seller").textContent = `Seller: ${listing.sellerId}`

    const stateEl = this.getControl("listing-state")
    stateEl.textContent = listing.state
    stateEl.className   = `listing-state ${listing.state}`
  }

  // ── Render action buttons ─────────────────────────────────────────────────

  renderActions (listing) {
    const panel = this.getControl("action-panel")

    // Hide all buttons first
    const btns = ["btn-purchase","btn-cancel","btn-fulfill","btn-dispute","btn-finalize"]
    btns.forEach(id => { this.getControl(id).style.display = "none" })

    const show = id => {
      const btn = this.getControl(id)
      btn.style.display = "inline-block"
      // Re-register handler (remove old listener to avoid stacking)
      btn.onclick = null
    }

    const role  = this.mRole
    const state = listing.state
    const now   = Date.now()

    if (state === StoreState.LISTED) {
      if (role === "SELLER") {
        show("btn-cancel")
        this.getControl("btn-cancel").onclick = () => this.onAction(StoreAction.CANCEL)
      }
      if (role === "PROSPECTIVE_BUYER") {
        show("btn-purchase")
        this.getControl("btn-purchase").onclick = () => this.onAction(StoreAction.PURCHASE)
      }
    }

    if (state === StoreState.PURCHASED) {
      if (role === "SELLER") {
        show("btn-fulfill")
        this.getControl("btn-fulfill").onclick = () => this.onAction(StoreAction.FULFILL)
      }
      if (role === "BUYER") {
        show("btn-dispute")
        this.getControl("btn-dispute").onclick = () => this.onAction(StoreAction.RAISE_DISPUTE)
      }
    }

    if (state === StoreState.FULFILLED) {
      if (role === "BUYER" &&
          listing.settlementDeadline !== null &&
          now < listing.settlementDeadline) {
        show("btn-dispute")
        this.getControl("btn-dispute").onclick = () => this.onAction(StoreAction.RAISE_DISPUTE)
      }
      if (listing.settlementDeadline !== null &&
          now >= listing.settlementDeadline &&
          !listing.settlementFinalized) {
        show("btn-finalize")
        this.getControl("btn-finalize").onclick = () => this.onAction(StoreAction.FINALIZE_SETTLEMENT)
      }
    }

    // Show panel only if any button is visible
    const anyVisible = btns.some(id =>
      this.getControl(id).style.display !== "none"
    )
    panel.style.display = anyVisible ? "block" : "none"
  }

  // ── Render receipt chain ──────────────────────────────────────────────────

  renderReceipts (listing) {
    if (!listing.receipts || listing.receipts.length === 0) {
      this.getControl("receipt-section").style.display = "none"
      return
    }

    const list = this.getControl("receipt-list")
    list.innerHTML = ""

    listing.receipts.forEach((r, i) => {
      const el   = document.createElement("div")
      el.className = "receipt-item"
      el.innerHTML = `
        <div class="receipt-transition">[${i}] ${r.fromState} → ${r.toState}</div>
        <div class="receipt-actor">actor: ${r.actor} &nbsp;|&nbsp; ${r.action}</div>
        <div class="receipt-hash">${r.receiptHash}</div>
      `
      list.appendChild(el)
    })

    this.getControl("receipt-section").style.display = "block"
  }

  // ── Action handler — phantom mode first ───────────────────────────────────

  onAction (action) {
    if (!this.mListing) return

    const myId   = CVMContext.getInstance().getUserFullID()
    const now    = Date.now()

    // Build ActionContext for phantom run
    const previousHash = this.mListing.receipts.length === 0
      ? "genesis"
      : this.mListing.receipts[this.mListing.receipts.length - 1].receiptHash

    const context = {
      actorId:         myId,
      timestamp:       now,
      expectedVersion: this.mListing.version,
      isSystemContext: action === StoreAction.FINALIZE_SETTLEMENT ||
                       action === StoreAction.RESOLVE_SELLER      ||
                       action === StoreAction.RESOLVE_BUYER,
      escrowTxId:        action === StoreAction.PURCHASE ? `escrow-pending-${now}` : undefined,
      deliveryProofHash: action === StoreAction.FULFILL  ? this.promptDeliveryProof() : undefined,
      previousHash
    }

    // Run engine as phantom — pure function, no side effects
    const phantom = executeAction(this.mListing, action, context, ECON_PARAMS)

    // Store pending state
    _private.get(this).pendingAction  = action
    _private.get(this).pendingContext = context

    // Show phantom preview panel
    this.showPhantomPreview(action, phantom)
  }

  // ── Phantom preview panel ─────────────────────────────────────────────────

  showPhantomPreview (action, result) {
    const panel = this.getControl("phantom-panel")
    panel.classList.add("visible")

    this.getControl("phantom-action").textContent =
      action

    this.getControl("phantom-state").textContent =
      result.ok ? result.listing.state : "—"

    const sd = result.deltas?.sellerDelta ?? 0
    const bd = result.deltas?.buyerDelta  ?? 0
    this.getControl("phantom-seller-delta").textContent =
      sd === 0 ? "none" : `${sd > 0 ? "+" : ""}${sd}`
    this.getControl("phantom-buyer-delta").textContent  =
      bd === 0 ? "none" : `${bd > 0 ? "+" : ""}${bd}`

    const resultEl = this.getControl("phantom-result")
    if (result.ok) {
      resultEl.textContent = "✓ Valid — ready to sign"
      resultEl.className   = "phantom-val phantom-ok"
    } else {
      resultEl.textContent = `✗ ${result.errors[0] ?? "Unknown error"}`
      resultEl.className   = "phantom-val phantom-fail"
    }

    // Confirm button — disabled if phantom failed
    const confirmBtn = this.getControl("btn-confirm-tx")
    confirmBtn.disabled = !result.ok
    confirmBtn.onclick  = result.ok ? () => this.submitTx() : null

    this.getControl("btn-cancel-tx").onclick = () => {
      panel.classList.remove("visible")
      _private.get(this).pendingAction  = null
      _private.get(this).pendingContext = null
    }
  }

  // ── Submit GridScript TX ──────────────────────────────────────────────────

  submitTx () {
    const priv   = _private.get(this)
    const action  = priv.pendingAction
    const context = priv.pendingContext
    if (!action || !context || !this.mListing) return

    // Hide phantom panel
    this.getControl("phantom-panel").classList.remove("visible")
    this.setStatus("Building transaction…", "pending")

    // Compute new listing state via engine (same call as phantom — deterministic)
    const result = executeAction(this.mListing, action, context, ECON_PARAMS)
    if (!result.ok) {
      this.setStatus(`Engine rejected TX: ${result.errors[0]}`, "error")
      return
    }

    // Serialise updated listing for DFS write
    const updatedJson  = JSON.stringify(result.listing)
    const updatedBytes = new TextEncoder().encode(updatedJson)

    // Build GridScript transaction:
    //   bt
    //   touch <path> -d <base64>   (write listing.ber to State-Domain)
    //   ct  →  QR  →  mobile sign  →  broadcast
    const vm       = CVMContext.getInstance()
    const path     = listingPath(this.mListing.id)
    const b64      = btoa(String.fromCharCode(...updatedBytes))
    const reqID    = vm.genRequestID()
    this.addNetworkRequestID(reqID)

    try {
      const gs = new GridScriptCompiler()
      gs.addLine("bt")
      gs.addLine(`touch ${path} -d ${b64}`)
      gs.addLine("ct")

      const metaGen = new CVMMetaGenerator()
      metaGen.setScript(gs.compile())
      metaGen.setReqID(reqID)

      vm.processVMMetaDataKF(metaGen)

      this.setStatus("Transaction submitted. Scan QR with GRIDNET Token app to sign.", "pending")
    } catch (err) {
      this.setStatus(`TX build failed: ${err}`, "error")
    }

    // Clear pending state
    priv.pendingAction  = null
    priv.pendingContext = null
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  promptDeliveryProof () {
    // In production: open a file picker or IPFS hash input dialog
    // For v1: use askString
    let proof = null
    this.askString(
      "Delivery Proof",
      "Enter delivery proof hash (IPFS CID or signed receipt hash):",
      value => { proof = value },
      true
    )
    return proof ?? ""
  }

  setStatus (msg, type = "") {
    const bar = this.getControl("status-bar")
    bar.textContent = msg
    bar.className   = `status-bar ${type}`
  }

  // ── Responsive layout ─────────────────────────────────────────────────────

  finishResize (isFallbackEvent) {
    super.finishResize(isFallbackEvent)
    const c = this.getControl("root")
    c.classList.remove("narrow", "mobile")
    if      (this.getClientWidth < 480) c.classList.add("narrow")
    else if (this.getClientWidth < 700) c.classList.add("mobile")
  }
}

// ---------------------------------------------------------------------------
// Static settings
// ---------------------------------------------------------------------------

CStoreGrid.sCurrentSettings = new CAppSettings(CStoreGrid.getPackageID())

export default CStoreGrid
