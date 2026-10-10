# Domain Docs

This repository uses a **single-context** domain documentation layout.

## Before exploring, read these

- `GLOSSARY.md` at the repository root, when present.
- Relevant decisions and normative specifications in `ADR.md`.
- Relevant extracts in `adrs/`, indexed by `adrs/README.md`. As that index states, the master `ADR.md` governs if an extract differs.
- Relevant subsequent decisions in `docs/adr/`, when present.

If the glossary or future ADR directory is absent, proceed silently. The `/domain-modeling` skill creates documentation lazily when terms or decisions are resolved.

## File structure

All paths are relative to the repository root:

```text
GLOSSARY.md       # Shared domain vocabulary; created when needed
ADR.md            # Existing master architecture and decisions ADR-001 through ADR-028
adrs/             # Existing individual extracts and their index
docs/adr/         # New decisions; created when needed
```

Keep the existing master and extracts in place. Number new decisions after the highest existing ADR number across both locations, initially ADR-029. A new ADR that changes an existing decision must identify the decision it supersedes and explain the change.

## Use the glossary's vocabulary

When naming a domain concept in an issue, proposal, hypothesis, or test, use the term defined in `GLOSSARY.md` and respect its stated distinctions.

If a needed concept is absent, check the existing product and architecture documents before inventing terminology. Note unresolved vocabulary gaps for `/domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, name the ADR and explain the conflict explicitly. Treat a decision as superseded only when a subsequent ADR explicitly records that change.
