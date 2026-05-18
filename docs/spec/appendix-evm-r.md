PLACEHOLDER
# OCP Appendix: EVM Extraction Rule

*Phase 2 deliverable — formal definition of `evm/event-log` for the Observation Commitment Protocol*

---

## Status

**Draft** — pending Gate 2 validation  
Companion to: `docs/spec/ocp-proof-envelope-v1.0.0.md`  
Implements: `extraction.rule_id: "evm/event-log"`  
Next: `docs/spec/appendix-solana-r.md` (Phase 3)

---

## Scope

This appendix formally specifies:

- The `evm/event-log` extraction rule (`R`) for EVM-compatible ledgers
- The `ObservationCommitment` reference contract
- The canonical verification procedure against raw EVM transaction receipts
- Finality recommendations for EVM chains
- Chain ID registry for supported EVM networks

This appendix does not define the proof envelope format — see `ocp-proof-envelope-v1.0.0.md`.

---

## Reference Contract

The OCP reference implementation uses a minimal Solidity contract with a single function and a single event.

### Source

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ObservationCommitment
/// @notice Minimal reference contract for recording OCP digest commitments.
/// @dev OCP defines the verification boundary; this contract only emits commitments.
contract ObservationCommitment {
    event Recorded(bytes32 indexed digest, address indexed recorder);

    function record(bytes32 digest) external {
        emit Recorded(digest, msg.sender);
    }
}
```

### Design rationale

The contract does nothing except emit an event. It holds no state. It performs no access control. It does not validate the digest. These are deliberate choices — OCP is a commitment primitive, not an application. The ledger is the source of truth; the contract is only a standardized write path.

The digest is emitted as an `indexed` topic, which means it is stored in the transaction receipt's log topics array — not in log data. This is significant for the extraction rule defined below.

---

## Extraction Rule: `evm/event-log`

**Rule ID:** `evm/event-log`  
**Rule version:** `1.0.0`  
**Namespace:** `evm`

### Definition

Given a raw EVM transaction receipt, the extraction rule `R` produces the set of all `bytes32` values that appear as indexed topics in log entries matching the `Recorded` event signature.

Formally:

```
R(receipt) = { topic[1] : log ∈ receipt.logs,
                           log.topics[0] = keccak256("Recorded(bytes32,address)"),
                           len(log.topics) >= 2 }
```

Where:
- `receipt.logs` is the array of log entries in the transaction receipt
- `log.topics[0]` is the event signature topic (the Keccak-256 hash of the event signature string)
- `log.topics[1]` is the first indexed parameter — the committed digest
- The result is a set of `bytes32` values, one per matching log entry

### Event signature topic

The event signature topic is the Keccak-256 hash of the canonical event signature string:

```
keccak256("Recorded(bytes32,address)")
```

This produces:

```
0x54c0f9b2b89e41ba0e1087fd2fa2a3efa9dbef7e5af0c2d7e2e8e4b5f08da26
```

A verifier must compute this value independently and not hardcode it from an external source.

### Step-by-step extraction procedure

The following procedure must be applied to raw receipt data. No library, SDK, or provider abstraction is required — only the ability to read raw RLP-decoded receipt structure.

**Step 1 — Obtain raw transaction receipt**  
Retrieve the transaction receipt for `ledger_ref.transaction_id` from the ledger identified by `chain.id`. The receipt must be obtained from a source the verifier trusts — a full node, an archive node, or a raw block export. RPC providers may be used but introduce a trust dependency that the verifier should note.

**Step 2 — Confirm block hash**  
Confirm that the block containing the transaction has hash equal to `ledger_ref.block_hash`. Reject if not equal.

**Step 3 — Locate matching logs**  
Iterate over `receipt.logs`. For each log entry:
- Check that `log.topics` has at least 2 entries
- Check that `log.topics[0]` equals `keccak256("Recorded(bytes32,address)")`
- If both conditions hold, this log entry is a match

**Step 4 — Extract digest values**  
For each matching log entry, take `log.topics[1]` as a raw 32-byte value. This is the committed digest. Collect all such values into the set `S`.

**Step 5 — Return S**  
Return `S` to the envelope verifier. The envelope verifier will confirm that `commitment.digest ∈ S`.

### Raw receipt structure reference

EVM transaction receipts are RLP-encoded. The relevant fields for this extraction rule are:

```
TransactionReceipt {
  ...
  logs: [
    Log {
      address:  <20 bytes>   // contract address that emitted the log
      topics:   [            // array of 32-byte indexed values
        <32 bytes>,          // topics[0]: event signature hash
        <32 bytes>,          // topics[1]: first indexed param (digest)
        <32 bytes>,          // topics[2]: second indexed param (recorder address, zero-padded)
      ]
      data:     <bytes>      // non-indexed params (empty for this event)
    }
  ]
}
```

For `ObservationCommitment.Recorded`:
- `topics[0]` = `keccak256("Recorded(bytes32,address)")` — the event selector
- `topics[1]` = the committed `bytes32` digest — this is what R extracts
- `topics[2]` = the `recorder` address, zero-padded to 32 bytes — not used by R
- `data` = empty (both parameters are indexed)

### What the verifier must NOT do

- Must not parse `log.data` to find the digest — it is in `topics[1]`, not data
- Must not filter logs by contract address alone — must also match the event signature topic
- Must not assume a transaction contains exactly one matching log — a transaction may call `record()` multiple times; all matches are included in S
- Must not accept a match where `log.topics[0]` is absent or does not equal the event signature hash

---

## Commitment Procedure

For reference, the commitment procedure that produces a valid envelope is:

1. Read the observation as raw bytes (no encoding applied)
2. Compute `H = SHA-256(raw bytes)`
3. Convert `H` to a `bytes32` value (no `0x` prefix, no length prefix)
4. Call `ObservationCommitment.record(H)` on the target chain
5. Obtain the transaction receipt
6. Wait for the recommended finality depth (see below)
7. Construct the proof envelope with:
   - `commitment.digest` = lowercase hex of `H`, no `0x` prefix
   - `commitment.hash_function` = `"sha2-256"`
   - `commitment.serialization` = `"raw-bytes"`
   - `extraction.rule_id` = `"evm/event-log"`
   - `extraction.rule_version` = `"1.0.0"`
   - All `ledger_ref` fields populated from the receipt

---

## Finality Recommendations

Finality on EVM chains is probabilistic. The following depth recommendations represent conservative minimums for general use. Applications with higher security requirements should increase these values.

| Chain | chain.id | Recommended depth | Rationale |
|---|---|---|---|
| Ethereum mainnet | `eip155:1` | 12 blocks | ~144 seconds; historically sufficient for re-org safety |
| Base mainnet | `eip155:8453` | 6 blocks | L2 with L1 settlement; lower re-org risk |
| Base Sepolia | `eip155:84532` | 3 blocks | Testnet; use for development only |
| Sepolia | `eip155:11155111` | 6 blocks | Testnet; use for development only |

A depth of `0` is valid in the envelope but indicates the proof was generated before any confirmations. Verifiers must surface this to the caller and must not treat it as a confirmed commitment.

---

## Supported Chain Registry

The following EVM chains are formally supported by this appendix. Chains not listed here may be used with this extraction rule but are not covered by OCP conformance testing.

| Network | chain.id | chain.namespace | Status |
|---|---|---|---|
| Ethereum mainnet | `eip155:1` | `evm` | Supported |
| Base mainnet | `eip155:8453` | `evm` | Supported |
| Base Sepolia | `eip155:84532` | `evm` | Supported (testnet) |
| Sepolia | `eip155:11155111` | `evm` | Supported (testnet) |

---

## Complete Proof Envelope Example

A conformant proof envelope for a commitment made on Base Sepolia:

```json
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
    "transaction_id": "0xabc123...",
    "block_height": 14500000,
    "block_hash": "0xdef456...",
    "finality": {
      "depth": 3,
      "assertion_time_utc": "2026-05-17T12:00:00Z"
    }
  },
  "extraction": {
    "rule_id": "evm/event-log",
    "rule_version": "1.0.0"
  },
  "meta": {
    "created_utc": "2026-05-17T12:00:05Z",
    "envelope_version": "1.0"
  }
}
```

Note: `commitment.digest` has no `0x` prefix. The existing `proof-format-v1` used a `0x`-prefixed hash field — the envelope format standardizes on no prefix for cross-chain consistency.

---

## Relation to existing proof-format-v1

The existing `proof-format-v1.md` and `proof-format-v1.schema.json` describe an earlier, EVM-specific proof format. The mapping between the two formats is:

| proof-format-v1 field | Envelope field | Notes |
|---|---|---|
| `hash` | `commitment.digest` | Remove `0x` prefix |
| `txHash` | `ledger_ref.transaction_id` | Same format |
| `network` | `chain.id` | Convert to CAIP-2 (e.g. `base-sepolia` → `eip155:84532`) |
| `contract` | Not in envelope | Contract address is implicit in `extraction.rule_id` |
| `extractionRule` | `extraction.rule_id` | Replaced by formal rule registry |
| `timestamp` | `meta.created_utc` | Convert ms epoch to ISO 8601 |
| `fileName` | Not in envelope | Descriptive only; out of scope for OCP |
| `version` | `ocp` + `meta.envelope_version` | Split into two versioned fields |

The v1 format remains valid for existing proofs. New proofs should use the envelope format.

---

## Gate 2 checklist

- [ ] A verifier can extract the digest from a raw Base Sepolia transaction receipt without ethers.js or any EVM library
- [ ] The event signature topic value can be independently computed from the string `"Recorded(bytes32,address)"`
- [ ] The extraction procedure correctly handles transactions with multiple `record()` calls
- [ ] The block hash confirmation step is implemented and tested
- [ ] At least one real proof envelope has been generated and verified end-to-end against a live Base Sepolia transaction
- [ ] The finality depth at time of verification is surfaced to the caller, not silently assumed

---

*Observation Commitment Protocol — docs/spec/appendix-evm-r.md*
*github.com/damonzwicker/observation-commitment-protocol*
