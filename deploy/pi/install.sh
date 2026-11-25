#!/usr/bin/env bash
# Installs the podcast-trigger systemd timer on a Raspberry Pi.
# Re-run to rotate the token. See docs/raspberry-pi-trigger.md.
#
# Usage: sudo deploy/pi/install.sh [--uninstall]

set -euo pipefail

readonly UNIT_NAME=podcast-trigger
readonly UNIT_DIR=/etc/systemd/system
readonly CRED_DIR=/etc/podcast-trigger
readonly CRED_FILE="$CRED_DIR/github-auth-header"
readonly WORKFLOW_URL=https://api.github.com/repos/denolfe/hacker-news-highlights/actions/workflows/generate-podcast.yml
# LoadCredential with the %d specifier, and curl --fail-with-body
readonly MIN_SYSTEMD=250
readonly MIN_CURL=7.76.0

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR

# Global so the EXIT trap can still see it after install() returns
HEADER_FILE=''
trap '[[ -n $HEADER_FILE ]] && rm -f "$HEADER_FILE"' EXIT

main() {
  case "${1:-}" in
    '') install ;;
    --uninstall) uninstall ;;
    -h | --help) usage ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

install() {
  preflight

  local token
  read -rsp 'Fine-grained GitHub token (input hidden): ' token
  echo
  # Classic tokens (ghp_) cannot be limited to one repo and Actions only
  if [[ $token != github_pat_* ]]; then
    die 'Expected a fine-grained token (starts with github_pat_)'
  fi

  # Stage the header in a root-only temp file so the token never appears in
  # process arguments, including during the check below
  HEADER_FILE=$(umask 077 && mktemp)
  printf 'Authorization: Bearer %s\n' "$token" >"$HEADER_FILE"
  unset token

  check_token "$HEADER_FILE"

  install -d -m 0700 "$CRED_DIR"
  install -m 0600 "$HEADER_FILE" "$CRED_FILE"
  echo "Token written to $CRED_FILE"

  install -m 0644 "$SCRIPT_DIR/$UNIT_NAME.service" "$SCRIPT_DIR/$UNIT_NAME.timer" "$UNIT_DIR/"
  systemd-analyze verify "$UNIT_DIR/$UNIT_NAME.service" "$UNIT_DIR/$UNIT_NAME.timer"
  systemctl daemon-reload
  systemctl enable --now "$UNIT_NAME.timer"

  echo
  systemctl list-timers "$UNIT_NAME.timer" --no-pager
  echo
  echo "Installed. No dispatch was sent."
  echo "Logs: journalctl -u $UNIT_NAME.service -n 50"
}

uninstall() {
  require_root
  systemctl disable --now "$UNIT_NAME.timer" 2>/dev/null || true
  rm -f "$UNIT_DIR/$UNIT_NAME.service" "$UNIT_DIR/$UNIT_NAME.timer"
  systemctl daemon-reload
  systemctl reset-failed "$UNIT_NAME.service" 2>/dev/null || true
  rm -rf "$CRED_DIR"
  echo "Uninstalled. Revoke the token in GitHub settings if it is no longer needed."
}

usage() {
  echo "Usage: sudo $0 [--uninstall]"
}

preflight() {
  require_root

  local systemd_version curl_version
  systemd_version=$(systemctl --version | awk 'NR == 1 { print $2 }')
  if ((systemd_version < MIN_SYSTEMD)); then
    die "systemd $MIN_SYSTEMD+ required, found $systemd_version"
  fi

  curl_version=$(curl --version | awk 'NR == 1 { print $2 }')
  if ! version_at_least "$curl_version" "$MIN_CURL"; then
    die "curl $MIN_CURL+ required, found $curl_version"
  fi

  for unit in "$UNIT_NAME.service" "$UNIT_NAME.timer"; do
    [[ -f "$SCRIPT_DIR/$unit" ]] || die "Missing $SCRIPT_DIR/$unit"
  done
}

# Read access proves the token is valid and scoped to this repo. Write access
# is only provable by dispatching, which would start a real run.
check_token() {
  local header_file=$1 status
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H @"$header_file" \
    "$WORKFLOW_URL")
  if [[ $status != 200 ]]; then
    die "Token check failed: HTTP $status from $WORKFLOW_URL"
  fi
  echo "Token can read the workflow (HTTP 200)"
}

require_root() {
  ((EUID == 0)) || die 'Run as root (sudo)'
}

version_at_least() {
  [[ $(printf '%s\n' "$2" "$1" | sort -V | head -n 1) == "$2" ]]
}

die() {
  echo "Error: $*" >&2
  exit 1
}

main "$@"
