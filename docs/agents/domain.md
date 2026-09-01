# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is **single-context**: one `CONTEXT.md` and one `docs/adr/` at the root.

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-some-decision.md
│   └── 0002-another-decision.md
└── app/
```

If this repo ever splits into multiple bounded contexts, switch to a root `CONTEXT-MAP.md` pointing at one `CONTEXT.md` per context, with context-scoped `docs/adr/` alongside each.

## Superseding an ADR

An ADR is never deleted and never quietly rewritten. When a later decision replaces one:

- The superseded record's frontmatter becomes `status: superseded by ADR-NNNN`. Everything else in this repo is `status: accepted`, so that line is the whole signal.
- Its title stays, and its body is cut back to a pointer at the record that replaces it, what of it still holds, and what stopped being true. A reader who arrives from a citation needs to know which paragraphs to stop trusting, and a body left intact under a status line does not tell them.
- The new ADR restates whatever rule survived, with its reasoning, so that nothing live is only documented in a superseded record.
- Citations elsewhere are left pointing where they point. Following one lands on the superseded record's note, which is what tells a reader the decision moved — and code or prose still describing the old behaviour is describing what is still shipped until the change that replaces it lands.

`docs/adr/0004-one-prediction-per-bout.md`, superseded by ADR-0014, is the worked example.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
