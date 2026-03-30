# Bug Filing Guide — Repository Integration

## GitHub Issue Creation (Claude Code)

### Prerequisites
- `gh` CLI must be authenticated: run `gh auth status` to verify
- You must have write access to the repository

### Single Bug Filing
```bash
gh issue create \
  --title "[HIGH] [API] POST /orders returns 500 with special characters in name" \
  --body-file ./qa-reports/bugs/BUG-001.md \
  --label "bug,severity:high,category:api,qa-run:2026-03-28" \
  --repo OWNER/REPO
```

### Batch Filing Script
```bash
for bugfile in ./qa-reports/bugs/BUG-*.md; do
  TITLE=$(head -1 "$bugfile" | sed 's/^# //')
  SEVERITY=$(grep -oP 'Severity:\*\* \K\w+' "$bugfile" | tr '[:upper:]' '[:lower:]')
  CATEGORY=$(grep -oP 'Category:\*\* \K\w+' "$bugfile" | tr '[:upper:]' '[:lower:]')
  
  gh issue create \
    --title "$TITLE" \
    --body-file "$bugfile" \
    --label "bug,severity:${SEVERITY},category:${CATEGORY}" \
    --repo OWNER/REPO
  
  echo "Filed: $TITLE"
  sleep 1  # Rate limiting courtesy
done
```

### Summary Issue
After filing all individual bugs, create a summary:
```bash
gh issue create \
  --title "QA Test Run — $(date +%Y-%m-%d) — X Defects Found" \
  --body-file ./qa-reports/test-run-summary.md \
  --label "qa-report" \
  --repo OWNER/REPO
```

## GitLab Issue Creation

### Single Bug
```bash
glab issue create \
  --title "[HIGH] [API] POST /orders returns 500 with special characters" \
  --description "$(cat ./qa-reports/bugs/BUG-001.md)" \
  --label "bug,severity::high" \
  --no-editor
```

## Fallback: Local File-Based Bug Reports

If no CLI is available, or if the repository is not connected:

1. Create directory: `mkdir -p qa-reports/bugs/`
2. Create one file per bug: `qa-reports/bugs/BUG-001-brief-description.md`
3. Create summary: `qa-reports/test-run-summary.md`
4. Each file uses the full bug report template from SKILL.md Phase Q4.1
5. Inform the user these need to be filed manually or through the web UI

## Issue Labels to Create (If They Do Not Exist)

Before filing bugs, ensure these labels exist in the repository:
- `bug` — defect report
- `severity:critical` — system crash, data loss, security breach
- `severity:high` — major feature broken, significant risk
- `severity:medium` — edge case failure, workaround available
- `severity:low` — cosmetic, minor inconsistency
- `category:functional` — feature does not work as specified
- `category:api` — API contract violation
- `category:security` — security vulnerability
- `category:data-integrity` — data corruption or inconsistency
- `category:performance` — response time or resource issue
- `category:concurrency` — race condition or parallel execution issue
- `category:error-handling` — poor error response or crash
- `qa-run:YYYY-MM-DD` — links all bugs from a single test run

Create missing labels with:
```bash
gh label create "severity:critical" --color "B60205" --description "System crash, data loss, security breach" --repo OWNER/REPO
gh label create "severity:high" --color "D93F0B" --description "Major feature broken" --repo OWNER/REPO
gh label create "severity:medium" --color "FBCA04" --description "Edge case failure" --repo OWNER/REPO
gh label create "severity:low" --color "0E8A16" --description "Cosmetic or minor" --repo OWNER/REPO
```

## Duplicate Detection

Before filing a bug, search existing issues:
```bash
gh issue list --repo OWNER/REPO --label "bug" --search "keyword from bug title" --state open
```

If a matching issue exists, add a comment to the existing issue instead of creating a duplicate:
```bash
gh issue comment ISSUE_NUMBER --body "Additional reproduction path found during QA run $(date +%Y-%m-%d). See test case QA-XX-NNN." --repo OWNER/REPO
```
