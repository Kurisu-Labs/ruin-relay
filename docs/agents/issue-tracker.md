# Issue tracker: GitHub

Issues and specs for this repo live in [Kurisu-Labs/ruin-relay](https://github.com/Kurisu-Labs/ruin-relay/issues). Use the `gh` CLI for tracker operations.

Pass `--repo Kurisu-Labs/ruin-relay` to `gh issue`, `gh pr`, and `gh label` commands. This explicitly selects the repository even when the working directory has no Git remote. For `gh api`, use `repos/Kurisu-Labs/ruin-relay/...` endpoints.

## Conventions

- **Create an issue**: `gh issue create --repo Kurisu-Labs/ruin-relay --title "..." --body-file <body-file>`.
- **Read an issue**: `gh issue view <number> --repo Kurisu-Labs/ruin-relay --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --repo Kurisu-Labs/ruin-relay --state open --json number,title,body,labels,comments`, with appropriate `--label` and `--state` filters. Increase `--limit` or paginate with `gh api` when the task requires all matching issues.
- **Make an issue a sub-issue of a parent**: add `--parent <parent>` when creating it, or use `gh issue edit <parent> --repo Kurisu-Labs/ruin-relay --add-sub-issue <child>` (`gh` 2.94+). If unavailable, put `Part of #<parent>` at the top of the child body and link it in the parent's task list.
- **Comment on an issue**: `gh issue comment <number> --repo Kurisu-Labs/ruin-relay --body-file <body-file>`.
- **Apply / remove labels**: `gh issue edit <number> --repo Kurisu-Labs/ruin-relay --add-label "..."` / `--remove-label "..."`. Resolve triage roles through `triage-labels.md`.
- **Close**: `gh issue close <number> --repo Kurisu-Labs/ruin-relay`. Post any closing explanation as a comment first.

For multiline bodies and comments, write the exact Markdown to a temporary file and pass it with `--body-file`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

When set to `yes`, PRs run through the same labels and states as issues:

- **Read**: `gh pr view <number> --repo Kurisu-Labs/ruin-relay --comments` and `gh pr diff <number> --repo Kurisu-Labs/ruin-relay`.
- **List external PRs**: `gh api --paginate 'repos/Kurisu-Labs/ruin-relay/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: use `gh pr comment --body-file`, `gh pr edit --add-label` / `--remove-label`, and `gh pr close`, with the PR number and explicit repository.

GitHub shares one number space across issues and PRs. For an ambiguous `#<number>`, check `gh pr view` and fall back to `gh issue view`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `Kurisu-Labs/ruin-relay`.

## When a skill says "fetch the relevant ticket"

Read the GitHub issue using the command above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: an issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a sub-issue of the map. If sub-issues are unavailable, link the child in the map's task list and put `Part of #<map>` at the top of the child body. Apply `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`); once claimed, assign it to the driving developer.
- **Blocking**: use GitHub's native issue dependencies. Add an edge with `gh api --method POST repos/Kurisu-Labs/ruin-relay/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. Obtain the numeric database ID with `gh api repos/Kurisu-Labs/ruin-relay/issues/<blocker> --jq .id`; it is distinct from the issue number. If dependencies are unavailable, use a `Blocked by: #<number>, #<number>` line in the child body. A ticket is unblocked when every blocker is closed.
- **Frontier**: inspect the map's open children; exclude assigned tickets and tickets with open blockers. Native `issue_dependencies_summary.blocked_by` counts open blockers; otherwise inspect the `Blocked by` references. First in map order wins.
- **Claim**: `gh issue edit <number> --repo Kurisu-Labs/ruin-relay --add-assignee @me`, before starting work.
- **Resolve**: comment with the answer, close the ticket, then append a gist and link to the map's Decisions-so-far section.
