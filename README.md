# GridCoDe

Deterministic Vault-Based Coordination Framework  
Built on Gridnet OS

---

## Repository Purpose

This repository contains the canonical documentation and protocol specifications for GridCoDe.

All protocol-layer documents are version-controlled and migrated from original signed source files.

---

## Documentation Structure

The `/docs` directory contains the canonical, MDCR-aligned documentation set organized by protocol domain:

/docs
- core/          ← document control, MDCR, governance workflow
- runtime/       ← Gridnet execution model and contract specifications
- store/         ← StoreVault system (Store v1)
- engine/        ← engine-level specifications and logic
- contracts/     ← contract definitions and lifecycle models
- economics/     ← tokenomics and incentive structures
- governance/    ← DAO and governance mechanisms
- identity/      ← identity and reputation systems
- nft/           ← GridNFT and tokenized grid logic
- roadmap/       ← development roadmap
- clarification/ ← clarifications and amendments
- archive/       ← historical documents
- ux/            ← user experience and interface considerations
- whitepaper/    ← high-level system overview

All documents are version-controlled and governed under the Master Document Control Register (MDCR).
Each folder corresponds to a protocol layer of the GridCoDe ecosystem.

---

## Store v1 — Gridnet Integration Entry

The Store v1 implementation is the first executable GridCoDe module adapted for Gridnet OS.

### Entry Point

```
store-v1/dapp/CStoreGrid.app
```

This is the Gridnet-native dApp (CWindow UI shell).

---

### Architecture

```
store-v1/
  engine/    ← deterministic FSM (StoreVault)
  adapter/   ← runtime bridge
  dapp/      ← UI layer (entry point)
```

---

### Deployment Model (Gridnet)

Upload runtime modules to:

```
/store_v1/engine/*
/store_v1/adapter/*
```

> Note: The repository uses `store-v1`, while Gridnet runtime requires `store_v1` due to filesystem constraints.

---

### Recommended Reading Order

1. Store System

   * docs/store/storevault-implementation-brief-v1.0.md
   * docs/store/store-v1-protocol-spec-v1.0.md

2. Runtime Integration

   * docs/runtime/contract-specification-gcspec-v1.1.md
   * docs/runtime/runtime-execution-architecture-v1.1.md

3. Document Control

   * docs/core/master-document-control-register-v3.2.md

---

### Current Status

* Engine: complete (deterministic FSM)
* Adapter: simulation-ready
* UI: Gridnet-compliant shell

Pending integration:

* Gridnet CVMContext execution
* GridScript transaction layer
* Async UI interaction model

---


## Maintainer

GridCoDe-Ecosystem
