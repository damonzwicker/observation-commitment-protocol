#!/bin/bash

# OCP Conformance Suite v1.0.0
# Tests any OCP-compatible verifier against the full spec
# Usage: ./run-conformance.sh [verifier-command]
# Default verifier: node reference-cli/verify.js

VERIFIER="${1:-node reference-cli/verify.js}"
SUITE_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
ERRORS=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo ""
echo "OCP Conformance Suite v1.0.0"
echo "Verifier: $VERIFIER"
echo "-------------------------------------------"

# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

run_test() {
  local name="$1"
  local expected="$2"   # "pass" or "fail"
  local file="$3"
  local proof="$4"

  output=$($VERIFIER "$file" "$proof" 2>&1)
  exit_code=$?

  if [ "$expected" = "pass" ]; then
    if [ $exit_code -eq 0 ] && echo "$output" | grep -q "^VALID"; then
      echo -e "${GREEN}  PASS${NC}  $name"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}  FAIL${NC}  $name"
      echo "         expected: VALID"
      echo "         got:      $(echo "$output" | tail -1)"
      FAIL=$((FAIL + 1))
      ERRORS+=("$name")
    fi
  else
    if [ $exit_code -ne 0 ] && echo "$output" | grep -q "^INVALID"; then
      echo -e "${GREEN}  PASS${NC}  $name"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}  FAIL${NC}  $name"
      echo "         expected: INVALID"
      echo "         got:      $(echo "$output" | tail -1)"
      FAIL=$((FAIL + 1))
      ERRORS+=("$name")
    fi
  fi
}

# ---------------------------------------------------------------------------
# Setup — create test fixtures
# ---------------------------------------------------------------------------

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Real observation file
REAL_OBS="$SUITE_DIR/../examples/example-observation.txt"
REAL_PROOF="$SUITE_DIR/../examples/example-proof.ocp.json"

# Tampered observation — change one byte
TAMPERED_OBS="$TMPDIR/tampered.txt"
cp "$REAL_OBS" "$TAMPERED_OBS"
echo " " >> "$TAMPERED_OBS"

# Empty file
EMPTY_OBS="$TMPDIR/empty.txt"
touch "$EMPTY_OBS"

# Malformed proof — missing hash field
MISSING_HASH_PROOF="$TMPDIR/missing-hash.proof.json"
cat > "$MISSING_HASH_PROOF" << 'EOF'
{
  "version": "ocp-1",
  "txHash": "0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd",
  "network": "base-sepolia",
  "contract": "0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c",
  "extractionRule": "evm-event:Recorded(bytes32 indexed digest,address indexed recorder)"
}
EOF

# Malformed proof — bad hash format
BAD_HASH_PROOF="$TMPDIR/bad-hash.proof.json"
cat > "$BAD_HASH_PROOF" << 'EOF'
{
  "version": "ocp-1",
  "hash": "not-a-valid-hash",
  "txHash": "0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd",
  "network": "base-sepolia",
  "contract": "0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c",
  "extractionRule": "evm-event:Recorded(bytes32 indexed digest,address indexed recorder)"
}
EOF

# Malformed proof — wrong hash (different file)
WRONG_HASH_PROOF="$TMPDIR/wrong-hash.proof.json"
cat > "$WRONG_HASH_PROOF" << 'EOF'
{
  "version": "ocp-1",
  "hash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "txHash": "0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd",
  "network": "base-sepolia",
  "contract": "0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c",
  "extractionRule": "evm-event:Recorded(bytes32 indexed digest,address indexed recorder)",
  "timestamp": 1777222524027
}
EOF

# Malformed proof — invalid JSON
INVALID_JSON_PROOF="$TMPDIR/invalid-json.proof.json"
echo "{ this is not json }" > "$INVALID_JSON_PROOF"

# Malformed proof — unknown network
UNKNOWN_NETWORK_PROOF="$TMPDIR/unknown-network.proof.json"
cat > "$UNKNOWN_NETWORK_PROOF" << 'EOF'
{
  "version": "ocp-1",
  "hash": "0x14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73",
  "txHash": "0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd",
  "network": "unknown-chain-xyz",
  "contract": "0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c",
  "extractionRule": "evm-event:Recorded(bytes32 indexed digest,address indexed recorder)",
  "timestamp": 1777222524027
}
EOF

# Malformed proof — transaction not found
TX_NOT_FOUND_PROOF="$TMPDIR/tx-not-found.proof.json"
cat > "$TX_NOT_FOUND_PROOF" << 'EOF'
{
  "version": "ocp-1",
  "hash": "0x14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73",
  "txHash": "0x0000000000000000000000000000000000000000000000000000000000000001",
  "network": "base-sepolia",
  "contract": "0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c",
  "extractionRule": "evm-event:Recorded(bytes32 indexed digest,address indexed recorder)",
  "timestamp": 1777222524027
}
EOF

# Envelope format — valid
ENVELOPE_VALID_PROOF="$TMPDIR/envelope-valid.proof.json"
cat > "$ENVELOPE_VALID_PROOF" << 'EOF'
{
  "ocp": "1.0",
  "chain": {
    "id": "eip155:84532",
    "namespace": "evm"
  },
  "commitment": {
    "digest": "14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73",
    "hash_function": "sha2-256",
    "serialization": "raw-bytes"
  },
  "ledger_ref": {
    "transaction_id": "0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd",
    "block_height": 41658348,
    "block_hash": "0x33c95ee00e6ecc1c0a1110e11a9027d6a7368469f3d411ec7b4c345c1115706d",
    "finality": {
      "depth": 3,
      "assertion_time_utc": "2026-05-19T12:00:00Z"
    }
  },
  "extraction": {
    "rule_id": "evm/event-log",
    "rule_version": "1.0.0"
  },
  "meta": {
    "created_utc": "2026-05-19T12:00:05Z",
    "envelope_version": "1.0"
  }
}
EOF

# Envelope format — wrong block hash
ENVELOPE_BAD_BLOCK_PROOF="$TMPDIR/envelope-bad-block.proof.json"
cat > "$ENVELOPE_BAD_BLOCK_PROOF" << 'EOF'
{
  "ocp": "1.0",
  "chain": {
    "id": "eip155:84532",
    "namespace": "evm"
  },
  "commitment": {
    "digest": "14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73",
    "hash_function": "sha2-256",
    "serialization": "raw-bytes"
  },
  "ledger_ref": {
    "transaction_id": "0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd",
    "block_height": 41658348,
    "block_hash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "finality": {
      "depth": 3,
      "assertion_time_utc": "2026-05-19T12:00:00Z"
    }
  },
  "extraction": {
    "rule_id": "evm/event-log",
    "rule_version": "1.0.0"
  },
  "meta": {
    "created_utc": "2026-05-19T12:00:05Z",
    "envelope_version": "1.0"
  }
}
EOF

# ---------------------------------------------------------------------------
# Test Group 1: Valid proofs — MUST pass
# ---------------------------------------------------------------------------

echo ""
echo "Group 1: Valid proofs (must PASS)"

run_test "proof-format-v1 — real Base Sepolia tx" \
  "pass" "$REAL_OBS" "$REAL_PROOF"

run_test "envelope format — real Base Sepolia tx" \
  "pass" "$REAL_OBS" "$ENVELOPE_VALID_PROOF"

# ---------------------------------------------------------------------------
# Test Group 2: Tampered observations — MUST fail
# ---------------------------------------------------------------------------

echo ""
echo "Group 2: Tampered observations (must FAIL)"

run_test "observation with one byte added" \
  "fail" "$TAMPERED_OBS" "$REAL_PROOF"

run_test "empty file against real proof" \
  "fail" "$EMPTY_OBS" "$REAL_PROOF"

# ---------------------------------------------------------------------------
# Test Group 3: Malformed proofs — MUST fail
# ---------------------------------------------------------------------------

echo ""
echo "Group 3: Malformed proofs (must FAIL)"

run_test "missing hash field" \
  "fail" "$REAL_OBS" "$MISSING_HASH_PROOF"

run_test "invalid hash format" \
  "fail" "$REAL_OBS" "$BAD_HASH_PROOF"

run_test "wrong hash — hash mismatch" \
  "fail" "$REAL_OBS" "$WRONG_HASH_PROOF"

run_test "invalid JSON" \
  "fail" "$REAL_OBS" "$INVALID_JSON_PROOF"

run_test "unknown network" \
  "fail" "$REAL_OBS" "$UNKNOWN_NETWORK_PROOF"

# ---------------------------------------------------------------------------
# Test Group 4: Invalid on-chain state — MUST fail
# ---------------------------------------------------------------------------

echo ""
echo "Group 4: Invalid on-chain state (must FAIL)"

run_test "transaction not found on-chain" \
  "fail" "$REAL_OBS" "$TX_NOT_FOUND_PROOF"

run_test "envelope — wrong block hash" \
  "fail" "$REAL_OBS" "$ENVELOPE_BAD_BLOCK_PROOF"

# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

TOTAL=$((PASS + FAIL))
echo ""
echo "-------------------------------------------"
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}CONFORMANT${NC} — $PASS/$TOTAL tests passed"
  echo ""
  echo "This implementation conforms to OCP v1.0.0"
  echo "Spec: github.com/damonzwicker/observation-commitment-protocol"
  exit 0
else
  echo -e "${RED}NON-CONFORMANT${NC} — $PASS/$TOTAL tests passed, $FAIL failed"
  echo ""
  echo "Failed tests:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi
