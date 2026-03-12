---
description: Build, fix errors, commit, create PR, and merge — one-shot ship to main
allowed-tools: Bash(git:*), Bash(gh:*), Bash(yarn:*), Bash(npm:*), Bash(npx:*), Bash(cd:*), Bash(fly:*), Bash(cat:*), Bash(diff:*), Read, Edit, Write, Grep, Glob, AskUserQuestion
---

# /ship - Build, Commit, PR & Merge

Ship the current branch: build to catch errors, fix any that arise, commit all changes, push, open a PR against main, and merge it immediately.

---

## Step 1: Preflight Checks

1. Confirm we're on a feature branch (NOT `main`):
```bash
git branch --show-current
```
If on `main`, create a feature branch from the changes automatically.

2. Check there are changes to ship (staged, unstaged, or unpushed commits):
```bash
git status --porcelain
git log origin/main..HEAD --oneline
```
If nothing to ship, stop early.

---

## Step 2: Lint & Build

Run lint fix first, then build:

```bash
yarn fix
yarn build
```

**If build fails:**
- Read the error output carefully
- Fix the errors in the source files
- Re-run `yarn build` to confirm the fix
- Repeat until build succeeds
- Do NOT skip or ignore build errors

---

## Step 3: Commit

Stage and commit ALL changes (including any build fixes):

```bash
git add -A
```

Generate a commit message by analyzing the diff:
- Use conventional commit format (`feat:`, `fix:`, `chore:`, etc.)
- Keep it concise (1-2 lines)
- End with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

```bash
git commit -m "<message>"
```

---

## Step 4: Push & Create PR

1. Push the branch:
```bash
git push -u origin HEAD
```

2. Create a PR against `main`:
```bash
gh pr create --base main --title "<short title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points summarizing changes>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

The PR title should match the commit message subject (without the type prefix if it reads better).

---

## Step 5: Merge

Immediately merge the PR:

```bash
gh pr merge --squash --delete-branch
```

If merge fails due to checks, show the status and ask the user whether to force merge or wait.

---

## Step 6: Publish & Deploy Sub-packages

After merging, check if any sub-packages were modified and need publishing/deploying:

### MCP Server (`mcp-server/`)

If any files in `mcp-server/` were changed (check the PR diff):

1. Bump version:
```bash
cd mcp-server && npm version patch --no-git-tag-version
```

2. Build and publish:
```bash
yarn build && npm publish
```

3. Commit the version bump back to main:
```bash
cd .. && git add -A && git commit -m "chore: bump @open-lattice/mcp to <version>" && git push
```

### Scout Worker (`scout-worker/`)

If any files in `scout-worker/` were changed (check the PR diff):

```bash
cd scout-worker && fly deploy
```

Note: The scout worker Dockerfile installs `@open-lattice/mcp@latest`, so if only the MCP server changed (not scout-worker code), a redeploy is only needed if you want the scout to pick up the new MCP version immediately. Otherwise it'll pick it up on next container restart.

### Public Skill/Heartbeat Docs (`public/skill.md`, `public/heartbeat.md`)

These are served automatically by Next.js from `public/` — no extra deploy step needed beyond the Vercel deploy that happens on merge to main.

---

## Step 7: Final Output

```
✅ Shipped!

• Branch: <branch-name>
• Commit: <hash> - <message>
• PR: <url>
• Merged to main ✓
• MCP: @open-lattice/mcp@<version> published ✓ (if applicable)
• Scout: deployed to Fly.io ✓ (if applicable)
```
