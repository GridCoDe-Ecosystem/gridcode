---
title: GridCoDe Markdown Canonical Formatting Standard
version: v1.0
status: Active Binding
domain: Core
layer: Documentation Formatting Governance
tier: Tier-2
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/core/master-document-control-register-v3.0.md
  - /docs/core/tier-1-freeze-aligned-github-workflow-v1.0.md
last_reviewed: 2026-02
---

# GridCoDe Markdown Canonical Formatting Standard

Every Tier-1 document MUST follow this standard exactly. No variation. No improvisation. No stylistic drift. This prevents entropy across the binding specification set.

Applies to: `/docs/store/*`, `/docs/governance/*`, `/docs/runtime/*`, `/docs/nft/*`, `/docs/engine/*`, `/docs/identity/*`, `/docs/contracts/*`, `/docs/core/*`

## 1. YAML Metadata Header

Every Tier-1 document MUST begin with a YAML header block in this exact format:

```yaml
---
title: <Full Document Title>
version: vX.X
status: Active Binding
domain: <Store | Governance | Runtime | NFT | Core | Engine | Identity>
layer: <Specific Layer Description>
tier: <Tier-1 | Tier-2 | Tier-3>
environment: Gridnet OS
authoritative: true
supersedes: <None | filename>
requires:
  - /docs/<domain>/<filename>.md
last_reviewed: YYYY-MM
---
```

Then one blank line. Then the document title as a single `#` heading.

Example:

```yaml
---
title: GridCoDe Store v1 — Protocol Specification
version: v1.0
status: Active Binding
domain: Store
layer: Vault-Level Deterministic Commerce FSM
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/runtime/contract-specification-gcspec-v1.1.md
last_reviewed: 2026-02
---
```

Do NOT omit this block. Do NOT use partial headers.

## 2. Heading Hierarchy Rules

Use numeric hierarchical headings only.

```markdown
# Document Title              ← used once, at the top
## 1. Major Section
### 1.1 Subsection
#### 1.1.1 Deep Subsection    ← optional
```

Rules:

- `#` is used for the document title only — never for sections
- `##` is used for major sections — always numbered
- `###` is used for subsections — always numbered
- `####` is optional for deep subsections — always numbered
- Never skip heading levels

Do NOT use:

- All-caps section names
- Decorative emojis in section headings
- Horizontal rule separators between sections
- Roman numeral section identifiers

## 3. Code Block Standards

All code MUST be fenced with triple backticks and a language tag.

```typescript
simulateStoreAction(...)
```

For algebraic notation:

```markdown
δ : (L, A, actorId, role, T, P) → (L′, Δ, E)
```

Never indent code with 4 spaces. Always use triple backticks. Language tags are mandatory.

## 4. Tables

Use GitHub-standard markdown tables only.

```markdown
| From   | Action   | To        | Role Required |
|--------|----------|-----------|---------------|
| LISTED | PURCHASE | PURCHASED | BUYER         |
```

Do NOT embed HTML tables.

## 5. Formal Invariants Formatting

When writing invariant logic, keep algebra and prose visually isolated.

Preferred:

```markdown
If state === FULFILLED:
  deliveryProofHash MUST exist
```

Or:

```markdown
L.state ∈ S
```

Avoid mixing prose and algebra inside the same sentence.

## 6. Deterministic Assertions

When stating guarantees, use consistent normative language.

Use:

- MUST
- MUST NOT
- SHALL
- SHALL NOT
- MAY (only when explicitly permissive)

Do not use: should, might, could, would, may (unless permissive intent is explicit).

Tier-1 documents are normative, not advisory.

## 7. Terminology Consistency Rules

The following terms MUST be used exactly as written. Case sensitivity matters.

| Correct Term | Do Not Use |
|---|---|
| `StoreVault` | Store Vault, store vault, storevault |
| `ListingAggregate` | Listing, listing aggregate |
| `actorId` | actor_id, ActorId, actor ID |
| `settlementFinalized` | settlement_finalized, SettlementFinalized |
| `deliveryProofHash` | delivery_proof_hash, DeliveryProofHash |
| `disputeWindowMs` | dispute_window_ms, disputeWindow |
| `fulfillmentWindowMs` | fulfillment_window_ms, fulfillmentWindow |
| `minListingPriceGNC` | min_listing_price, minPrice |
| `receiptCount` | receipt_count, ReceiptCount |
| `escrowTxId` | escrow_tx_id, EscrowTxId |

## 8. Cross-Document References

When referencing another document, use canonical relative `/docs/...` paths.

Correct:

```markdown
See `/docs/engine/storevault-engine-invariant-contract-v1.0.md`
```

Do NOT reference `.docx` filenames. Do NOT use absolute URLs to GitHub. Do NOT use informal names.

## 9. Canonical Status Block

All binding documents MUST end with this block as the final content:

```markdown
---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — <Layer>
**Last Reviewed:** YYYY-MM
**Supersedes:** <None | filename>
**Requires:**
- `/docs/<domain>/<filename>.md`
```

This block creates traceability and enables automated registry validation.

## 10. Prohibited Formatting

Do NOT use in any Tier-1 or Tier-2 document:

- Bold entire paragraphs
- Emoji in headings
- Decorative horizontal separators between sections
- Mixed numbering styles (roman + numeric in same document)
- Roman numeral section identifiers
- Excessive horizontal rules
- Embedded images
- HTML tags of any kind
- Inline CSS

These are protocol specifications, not marketing documents.

## 11. Length and Duplication Discipline

Long documents are acceptable provided:

- Each section has a clear semantic boundary
- No content is duplicated across documents
- If logic appears in two documents, one MUST reference the other — not restate it

Violation of duplication discipline creates conflicting authority, which the freeze model prohibits.

## 12. Why This Standard Exists

Without formatting discipline, specification drift begins. The GridCoDe protocol has multiple Tier-1 binding documents, multiple FSM extensions planned, and a future governance model. Consistent formatting ensures:

- Automated validation tooling can parse headers and status blocks
- Cross-references remain resolvable after renames
- The MDCR registry remains the single source of truth
- No document accumulates informal authority through stylistic divergence

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-2 — Documentation Formatting Governance
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/core/master-document-control-register-v3.0.md`
- `/docs/core/tier-1-freeze-aligned-github-workflow-v1.0.md`
