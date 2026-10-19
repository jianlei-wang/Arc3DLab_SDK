#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-jianlei-wang/Arc3DLab_SDK}"
BRANCHES="${BRANCHES:-master}"
REQUIRED_APPROVALS="${REQUIRED_APPROVALS:-0}"

for branch in $BRANCHES; do
  gh api \
    --method PUT \
    "repos/$REPO/branches/$branch/protection" \
    --input - <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["quality / gate"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": $REQUIRED_APPROVALS
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
done
