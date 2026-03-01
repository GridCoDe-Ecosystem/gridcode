---
title: GridCoDe — Tier-1 Freeze-Aligned GitHub Workflow
version: v1.0
status: Active Binding
domain: Core
layer: Repository Governance & Workflow Enforcement
tier: Tier-1
environment: Gridnet OS
authoritative: true
supersedes: None
requires:
  - /docs/core/master-document-control-register-v3.0.md
  - /docs/core/documentation-freeze-declaration-v1.0.md
last_reviewed: 2026-02
---

# GridCoDe — Tier-1 Freeze-Aligned GitHub Workflow

> This document does not define protocol behavior. It defines the repository workflow that enforces protocol governance discipline.

## 1. Source Discipline (Format-Agnostic)

Authoritative documents may originate as `.docx`, `.md`, draft text, or structured notes. File extension does not determine authority.

All documents MUST enter through a local `staging/` directory before promotion. `staging/` is a local working folder — it is not committed to the repository and does not appear in the canonical tree. No file may be created or edited directly inside `/docs/`. Staging is quarantine. `/docs/` is authoritative.

## 2. Canonical Normalisation (Inside staging/ Only)

Before promotion, every document MUST satisfy all structural rules.

### 2.1 Structural Rules

- YAML header present and correct
- Numeric heading hierarchy only
- No Roman numerals
- No bold headings
- No decorative separators
- Proper fenced code blocks
- Canonical terminology enforced
- Canonical Status block at bottom
- Correct relative `/docs/...` references

### 2.2 Validation Commands

```bash
grep -n "^# " staging/file.md
grep -n "\*\*" staging/file.md
grep -n "^[[:space:]]\{4,\}" staging/file.md
```

If any rule fails, fix in staging. Only clean files may be promoted.

## 3. Promotion to Authoritative Layer

Promotion MUST match MDCR taxonomy:

```
docs/
  core/
  identity/
  runtime/
  contracts/
  engine/
  store/
  nft/
  economics/
  governance/
  whitepaper/
  clarification/
  roadmap/
  archive/
```

`staging/` is local only and is never committed to the repository.

Example:

```bash
mv staging/storevault-engine-invariant-contract-v1.0.md \
   docs/engine/storevault-engine-invariant-contract-v1.0.md
```

Folder placement MUST reflect document classification as defined in MDCR v3.0. No arbitrary new folders.

## 4. Commit Discipline

```bash
git add docs/<domain>/<filename>.md
git commit -m "docs(<domain>): <filename> vX.X canonical normalization"
```

Examples:

```
docs(engine): storevault-engine-invariant-contract-v1.0 canonical normalization
docs(core): master-document-control-register-v3.0 constitutional update
docs(archive): relocate duplicate identity specs post-freeze normalization
```

Rules: domain must match folder, version must match YAML, no vague messages. Git log is the governance audit trail.

## 5. Authority Enforcement

If overlapping specs are detected:

```bash
git mv docs/<domain>/duplicate.md docs/archive/
git commit -m "docs(<domain>): archive duplicate — enforce single canonical authority"
```

One authoritative file per execution layer. No parallel definitions. No shadow specs. No forked invariants.

## 6. Branch Protection Rules

The following paths are Tier-1 protected:

```
docs/identity/
docs/runtime/
docs/contracts/
docs/store/
docs/core/
```

For all Tier-1 protected paths:

- Direct pushes to `main` are prohibited
- All modifications require a pull request
- Pull request requires at least one review approval
- YAML `version` field MUST be updated before merge — for every modification, invariant or non-invariant
- If an invariant is touched, a freeze tag MUST be applied after merge

Without branch protection, freeze discipline is cultural. These rules make it structural.

## 7. Tier Escalation Decision Gate

Before committing any change, the author MUST determine whether it constitutes a Tier-1 invariant change.

A change is a **Tier-1 invariant change** if it modifies any of the following:

- State set (adds, removes, or renames FSM states)
- Transition function (alters guard conditions or transition targets)
- Identity set (adds or removes SubID roles)
- Reputation mutation pathway
- Routing invariants (deep-link authority, auto-execution rules)
- Vault execution model (Phantom Mode, TX discipline, receipt model)

If the change qualifies as a Tier-1 invariant change:

```
1. Major version increment required (e.g. v1.0 → v2.0)
2. Cross-layer integrity review required (all dependent documents re-audited)
3. Freeze tag required after merge
4. MDCR updated to reflect new version
```

If the change is formatting, clarification, or non-invariant prose only:

```
1. Minor version increment (e.g. v1.0 → v1.1)
2. No freeze tag required
3. No cross-layer review required
```

When in doubt, treat the change as Tier-1 invariant.

## 8. Cross-Reference Validation

After any file rename, move, or deletion, the following MUST be run before committing:

```bash
# Check for stale references to old filename
grep -R "old-filename.md" docs/

# Confirm MDCR Section 9 matches actual tree
find docs/ -type f | sort
```

All stale references MUST be updated before promotion. MDCR Section 9 MUST match the actual repository tree exactly at the time of commit. Silent reference breakage is a constitutional violation.

## 9. Tag Governance

Tags are protocol governance markers, not cosmetic labels.

```bash
git tag -a v1.0-tier1-freeze -m "Tier-1 protocol spine frozen"
git push origin v1.0-tier1-freeze
```

Tag naming convention:

```
v1.0-tier1-freeze
docs-v3.0-mdcr-update
store-v1-engine-freeze
runtime-v1-consolidation
```

Tags encode structural checkpoints. Every Tier-1 change event MUST produce a tag.

## 10. Canonical Status Block (Mandatory)

All binding specs MUST end with:

```
---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — <Layer>
**Last Reviewed:** YYYY-MM
**Supersedes:** <if any>
**Requires:** <dependency paths>
```

Dependency paths MUST use canonical `/docs/...` format.

## 11. Archive Discipline

Archived documents live in `/docs/archive/`. They:

- SHALL NOT appear in MDCR active layer listings
- SHALL NOT override binding specs
- SHALL NOT be referenced by active specs

MDCR lists binding documents only. Archive subfolders:

```
docs/archive/
  duplicates-pre-freeze/
  runtime-legacy/
```

## 12. Post-Tier-1 Freeze Rules

After Tier-1 freeze declaration, the following require a major version increment and governance approval:

- Invariant modification of any kind
- Identity class expansion
- Mutation pathway alteration
- Routing rule expansion
- Folder taxonomy change
- Any whitepaper language that overrides protocol spine

Protocol truth lives in binding specs. Whitepaper cannot override protocol spine.

## 13. Governance State

This repository operates in Deterministic Protocol Governance Mode. Every file has: domain placement, invariant boundaries, cross-references, freeze implications, and audit traceability.

Implementation proceeds on top of a stabilized spine.

## Final Principle

It does not matter if a file begins as `.docx` or `.md`. What matters is that it passes canonical staging, aligns with MDCR, respects Tier-1 freeze, and preserves invariant discipline. That is protocol governance maturity.

---

**Canonical Status:** Active Binding
**Document Tier:** Tier-1 — Repository Governance
**Last Reviewed:** 2026-02
**Supersedes:** None
**Requires:**
- `/docs/core/master-document-control-register-v3.0.md`
- `/docs/core/documentation-freeze-declaration-v1.0.md`
