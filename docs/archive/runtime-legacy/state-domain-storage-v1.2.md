---
title: GridCoDe State-Domain Contract & Storage Guide
version: v1.2
status: Active Binding
domain: Runtime
layer: Persistent Data Storage
tier: Tier-1
environment: Gridnet OS
authoritative: true
---

# GridCoDe State-Domain Contract & Storage Guide

## 1. Purpose

This document defines how GridCoDe stores, loads, updates, validates, and synchronises all decentralised data using Gridnet OS State-Domains.

v1.2 includes updates reflecting Gridnet OS changes:

- Worker-based BER decoding (mandatory)
- Metadata correctness enforcement
- Phantom Mode consistency validation
- Async identity-bound notifications
- Nonce/IV validation
- ZKP-ready storage extension fields

This document is required reading for any developer modifying GridCoDe persistence logic.

## 2. What a State-Domain Is

A State-Domain is a decentralised, identity-owned filesystem hosting:

- Marketplace files (Store UI, Trade UI, Challenge UI)
- BER metadata for products, grids, challenges, and proofs
- Vault configuration files
- Identity and reputation cache files
- Thumbnails and UI assets

Each State-Domain is tied to a specific identity or sub-identity, a private-marketplace context, and decentralised DFS storage replicated across operator nodes.

State-Domains allow GridCoDe to run fully decentralised marketplaces without centralised servers.

## 3. State-Domain Lifecycle

### 3.1 Activation

Occurs when a user activates a Store Grid, Trade Grid, Challenge Grid, Private Marketplace, or Lending Grid. Creates:

```markdown
/index.html              (optional)
/marketplace-config.ber
/vault-config/*.ber
/products/*.ber
/grid/*.ber
```

### 3.2 Operation

During normal use, GridCoDe writes:

- Product listings
- Challenge submissions
- Reputation snapshots
- Vault config updates
- Thumbnails

### 3.3 Expiry and Renewal

When a grid expires:

- State-Domain REMAINS intact
- New writes are paused until renewed
- Public Market marks listings as inactive

Expiry SHALL NOT destroy existing State-Domain data.

## 4. Contract Metadata Stored in State-Domains

### 4.1 StoreVault Metadata

```markdown
File: /vault-config/store.ber
Contains:
  - escrow rules
  - delivery rules
  - payout windows
  - expiration time
  - seller identity
```

### 4.2 ChallengeVault Metadata

```markdown
File: /challenges/{slotId}.ber
Contains:
  - proof type
  - hash
  - oracle signature
  - reward amount
  - timestamp
  - zkpPayload (reserved, optional)
```

### 4.3 Reputation Metadata

```markdown
File: /profile/reputation.ber
Contains:
  - reputation scores
  - last reputation event
  - reputation zone snapshot
```

### 4.4 GridNFT Metadata

```markdown
File: /grid/store-grid.ber
Contains:
  - slot states
  - staking info
  - expiry time
  - ownership
```

## 5. BER Metadata Versioning Rules

Every BER file MUST include:

```markdown
version:       uint8
flags:         uint8
timestamp:     uint64
payloadLength: uint32
payload:       var
checksum:      uint32
```

### 5.1 Validation Rules

```markdown
If checksum fails       → metadata invalid → auto-resync required
If version mismatch     → migrate or reject
If mandatory fields missing → throw metadataInvalid
```

### 5.2 Worker Requirement

All BER decoding MUST be done inside Web Workers. Decoding MUST NEVER occur on the UI thread.

## 6. Worker Integration Requirements

GridCoDe MUST offload all CPU-heavy parsing to Workers:

- BER decoding
- Metadata validation
- Thumbnail generation
- Proof hashing
- Market indexing

Workers return lightweight descriptors, not full objects. This is required because metadata instantiation on the main thread causes UI freezes of 5–20 seconds.

## 7. Metadata Correctness Checks (Mandatory)

Workers MUST validate the following before passing metadata to Phantom Mode:

### 7.1 Required Fields Check

Missing required fields MUST cause rejection and trigger resync.

### 7.2 Owner Identity Check

State-Domain MUST match the active identity or sub-identity.

### 7.3 Timestamp Check

Newer metadata MUST NOT have older timestamps than the version it replaces.

### 7.4 Flag Check

Workers MUST detect and respond to these flag states:

- `corrupted` — reject and rebuild
- `needsResync` — trigger resync
- `oldVersion` — migrate
- `incomplete` — reject

### 7.5 Checksum Check

Checksum failure MUST trigger metadata rebuild. Workers compute checksum independently and compare.

## 8. Storage Rules Per GridCoDe Component

### 8.1 Product Listings

```markdown
Location:  /products/{slotId}.ber
Thumbnail: /thumbnails/{slotId}.bitmap

Metadata includes: name, price, category, ownerIdentity, tags, imageRef
```

### 8.2 Marketplace Config

```markdown
File: /marketplace-config.ber
Contains: marketplace type, layout theme, store/trade/challenge grid references, version flags
```

### 8.3 Public Market Sync

The Public Market indexer:

- Reads all State-Domains
- Extracts BER descriptors via Workers
- Applies ranking (Visibility Index)
- Shows listings globally

This indexing MUST happen in a Worker.

### 8.4 Vault Configuration Files

```markdown
/vault-config/store.ber
/vault-config/trade.ber
/vault-config/challenge.ber
```

### 8.5 Identity and Profile

```markdown
/profile/identity.ber
/profile/reputation.ber
```

## 9. Phantom Mode Validation

After Gridnet OS Phantom Mode improvements, GridCoDe MUST verify:

```markdown
chain -phantom on
<simulate contract>
chain -phantom report
```

Metadata MUST decode identically in Phantom Mode. If metadata decodes differently, this indicates corruption and requires a rebuild.

Workers build a normalised Phantom Mode input by combining relevant `.ber` files and returning a deterministic simulation digest `simulation_result_hash`. This hash MUST match `receipt-preconfirm.simulation_result_hash`.

## 10. Identity & Sub-Identity Isolation Rules

Each sub-identity MUST:

- Have its own State-Domain
- Maintain separate Vault configurations
- Maintain separate marketplace layouts
- Reload fully on identity switch

Switching identities triggers: DFS reload, metadata re-validation, vault-context reload, and UI refresh.

## 11. ZKP-Ready Metadata Fields

All GridCoDe BER schemas include a forward-compatible ZKP field:

```markdown
zkpPayload: bytes (optional)
```

Reserved for future:

- Private purchases
- Private challenge proofs
- Private reputation events
- Private listings

This field MUST be preserved and MUST NOT be stripped by Workers.

## 12. Recommended State-Domain Folder Layout

```markdown
/index.html
/app.js
/style.css
/marketplace-config.ber

/grid/
  store-grid.ber
  challenge-grid.ber

/products/
  1.ber
  2.ber
  ...

/thumbnails/
  1.bitmap
  2.bitmap

/challenges/
  slot-1.ber
  slot-5.ber

/vault-config/
  store.ber
  trade.ber
  challenge.ber

/profile/
  identity.ber
  reputation.ber
```

## 13. Error Handling & Recovery

### 13.1 Metadata Corrupted

```markdown
UI shows: "Metadata corrupted. Attempt resync?"
Action: Worker-triggered rebuild
```

### 13.2 Version Mismatch

```markdown
UI shows: "Metadata outdated. Migrating..."
Action: Worker migration procedure
```

### 13.3 Worker Decode Failure

```markdown
UI shows: "Could not decode metadata. Reset required."
Action: Full State-Domain rescan
```

### 13.4 Phantom Mode Inconsistency

```markdown
Action: Block execution, log inconsistency, require rebuild
```

### 13.5 Recovery Tools

Users MUST have access to:

- "Refresh Market Data"
- "Clear Cache & Rescan"
- "Retry Indexing"

These actions instruct Workers to re-parse the State-Domain systematically.

## 14. Security & Anti-Tamper Rules

All metadata mutations MUST be anchored by confirmed receipts. Specifically:

- A metadata mutation MUST correspond to a confirmed OS transaction receipt AND a confirmed Vault receipt.
- Preconfirm receipts (receipt-preconfirm.ber) SHALL NOT trigger permanent metadata persistence. They are used for Phantom Mode hash validation only.
- If a Worker detects a metadata update without both a confirmed OS receipt and a confirmed Vault receipt, it MUST flag the update for audit and reject the mutation.

Workers MUST reject files exceeding `max_metadata_size` to prevent VRAM exhaustion.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier 1 — Protocol Spine
**Last Reviewed:** 2026-02
**Supersedes:** State-Domain Contract & Storage Guide v1.1
**Requires:**
- `/docs/runtime/runtime-execution-architecture-v1.1.md`
- `/docs/runtime/gcspec-v1.1.md`
