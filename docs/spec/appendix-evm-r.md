# OCP Appendix: EVM Extraction Rule

*Phase 2 deliverable — formal definition of `evm/event-log` for the Observation Commitment Protocol*

---

## Status

**Draft** — Gate 2 validated  
Companion to: `docs/spec/ocp-proof-envelope-v1.0.0.md`  
Implements: `extraction.rule_id: "evm/event-log"`  
Next: `docs/spec/appendix-solana-r.md` (Phase 3)

---

## Provenance

The Observation Commitment Protocol was publicly released on **April 5, 2026** via ethresear.ch:
https://ethresear.ch/t/observation-commitment-protocol-ocp-v1-0-0/24602

The core protocol — including both the write side (digest computation, serialization, on-chain submission) and the read side (extraction, verification, proof envelope) — has been part of OCP since v1.0.0. The write side was implemented in the reference CLI (`reference-cli/commit.js`) and the VeraFile application prior to this formal specification. This appendix formalizes what was previously implicit in the implementation.

The full commit history establishing priority is publicly verifiable at:
https://github.com/damonzwicker/observation-commitment-protocol

Key public timestamps:
- **April 5, 2026** — OCP v1.0.0 published on ethresear.ch with adversarial falsification challenge
- **April 13, 2026** — Synchronous composability case study published on ethresear.ch
- **May 19, 2026** — Proof envelope schema, EVM extraction rule, and zero-dependency verifier committed to main
- **May 19, 2026** — First external contribution (PR #1, dinamic.eth / ERC-8004) merged

ERC-8263 was filed May 14, 2026. OCP's write-side implementation and public specification predate this filing by over six weeks.

The reference application implementing the full commit-and-verify cycle 
(hashFile, anchorHash, createProof, verifyProof) was built and deployed 
on April 6, 2026. A live proof artifact from April 3, 2026 — predating 
the ethresear.ch publication — is preserved at:
examples/ocp-falsification-challenge-april-2026.ocp.json

Transaction: 0x284747d8e6ff559690b3fb548ab5805ac9e96c73775d1ad5b72b83f4a98a8407
Contract: 0x57ce0d3AfB808B50F23ad1550CC5fa9aa9273859 (Base Sepolia)

---

## Scope

This appendix formally specifies both sides of the OCP commitment cycle for EVM-compatible ledgers:

**Write side — Commitment Procedure**
- How an observation is prepared and submitted on-chain
- The `ObservationCommitment` reference contract interface
- Serialization, hashing, and encoding rules
- How the resulting transaction becomes the basis for a proof envelope

**Read side — Extraction Rule**
- The `evm/event-log` extraction rule (`R`)
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

**Deployed reference implementation — Base Sepolia:**
`0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c`

---

## Write Side: Commitment Procedure

This section formally defines how an observation is committed to an EVM ledger. A conformant commitment produces a transaction from which the digest can be independently extracted using the `evm/event-log` rule defined in the Read Side section below.

The write side has been part of OCP since v1.0.0. The reference implementation (`reference-cli/commit.js`) and the VeraFile application both implement this procedure. This section formalizes the specification.

### Step 1 — Prepare the observation

The observation is any arbitrary byte sequence. No encoding, framing, or transformation is applied before hashing.

```
observation ∈ {0,1}*
```

If the observation is a file, it is read as raw bytes. If it is a string, it is encoded to bytes using a declared encoding (UTF-8 recommended). The encoding must be consistent between commitment and verification — the verifier must apply the same encoding to reproduce the digest.

### Step 2 — Compute the digest

Apply SHA-256 to the raw observation bytes:

```
H = SHA-256(observation)
```

- Hash function: `sha2-256`
- Serialization: `raw-bytes` — no length prefix, no framing, no encoding applied
- Output: 32 bytes

The digest `H` is the canonical representation of the observation. If a single byte of the observation changes, `H` changes. This is the falsifiability guarantee established in OCP v1.0.0.

### Step 3 — Encode the digest for submission

Convert `H` to a `bytes32` value for Solidity:

- Raw 32 bytes, no `0x` prefix, no length prefix
- Lowercase hex when represented as a string
- This value is passed directly to `record(bytes32 digest)`

### Step 4 — Submit the commitment

Call `record(H)` on a deployed `ObservationCommitment` contract:

```solidity
ObservationCommitment(contractAddress).record(bytes32(H));
```

This emits:

```
Recorded(bytes32 indexed digest, address indexed recorder)
```

Where:
- `digest` = `H` — the committed digest, stored as `topics[1]` in the transaction receipt
- `recorder` = `msg.sender` — the address that submitted the commitment

The transaction is broadcast to the network. Once included in a block, the commitment is permanent and independently verifiable.

### Step 5 — Wait for finality

Wait for the recommended block depth before treating the commitment as final. See Finality Recommendations below.

### Step 6 — Construct the proof envelope

Once finality depth is reached, construct the OCP proof envelope:

```json
{
  "ocp": "1.0",
  "chain": {
    "id": "<CAIP-2 chain ID>",
    "namespace": "evm"
  },
  "commitment": {
    "digest": "<H as lowercase hex, no 0x prefix>",
    "hash_function": "sha2-256",
    "serialization": "raw-bytes"
  },
  "ledger_ref": {
    "transaction_id": "<0x-prefixed tx hash>",
    "block_height": "<integer>",
    "block_hash": "<0x-prefixed block hash>",
    "finality": {
      "depth": "<integer>",
      "assertion_time_utc": "<ISO 8601>"
    }
  },
  "extraction": {
    "rule_id": "evm/event-log",
    "rule_version": "1.0.0"
  },
  "meta": {
    "created_utc": "<ISO 8601>",
    "envelope_version": "1.0"
  }
}
```

All `ledger_ref` fields are populated from the transaction receipt returned after the `record()` call is confirmed.

### What the committer must NOT do

- Must not apply any encoding, compression, or transformation to the observation before hashing
- Must not include metadata (filename, timestamp, author) in the hashed data unless those fields are part of the observation by definition
- Must not submit a digest computed from a transformed version of the observation without declaring the transformation in a higher-level layer
- Must not reuse a proof envelope from a previous commitment for a different observation

### Relation to ERC-8263

ERC-8263 (filed May 14, 2026) proposes `anchorProof(bytes32 agentId, bytes32 proofHash)` — a two-field interface that includes agent identity in the commitment call.

OCP's `record(bytes32 digest)` is intentionally identity-agnostic. Identity, authorship, and agent binding are explicitly out of scope for OCP — those concerns belong to higher-level layers (e.g., ERC-8004, EIP-712 attestations). OCP commits only the digest.

OCP predates ERC-8263 by over six weeks and specifies both the write side (this section) and the read side (extraction rule and verification procedure below). ERC-8263 specifies only the write side.

The two interfaces are complementary:
- ERC-8263 binds a proof hash to an agent identity on-chain
- OCP defines how that proof hash is produced, committed, and independently verified

A system implementing both would call `anchorProof(agentId, H)` where `H` is produced according to OCP's commitment procedure, and verify using OCP's extraction rule and proof envelope.

---

## Read Side: Extraction Rule `evm/event-log`

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

### Event signature topic

```
keccak256("Recorded(bytes32,address)")
= 0xdca60c2087041cbb12d9a57628c6cad28ecbd0437e47c7ab6c3aa6e162bf4497
```

A verifier must compute this value independently and not hardcode it from an external source.

### Step-by-step extraction procedure

**Step 1 — Obtain raw transaction receipt**  
Retrieve the transaction receipt for `ledger_ref.transaction_id` from the ledger identified by `chain.id`. No library, SDK, or provider abstraction is required — only the ability to read raw RLP-decoded receipt structure.

**Step 2 — Confirm block hash**  
Confirm that the block containing the transaction has hash equal to `ledger_ref.block_hash`. Reject if not equal.

**Step 3 — Locate matching logs**  
Iterate over `receipt.logs`. For each log entry:
- Check that `log.topics` has at least 2 entries
- Check that `log.topics[0]` equals `keccak256("Recorded(bytes32,address)")`
- If both conditions hold, this log entry is a match

**Step 4 — Extract digest values**  
For each matching log entry, take `log.topics[1]` as a raw 32-byte value. Collect all such values into the set `S`.

**Step 5 — Return S**  
Return `S` to the envelope verifier. The envelope verifier confirms that `commitment.digest ∈ S`.

### Raw receipt structure reference

```
TransactionReceipt {
  logs: [
    Log {
      address:  <20 bytes>   // contract address that emitted the log
      topics:   [
        <32 bytes>,          // topics[0]: event signature hash
        <32 bytes>,          // topics[1]: committed digest (what R extracts)
        <32 bytes>,          // topics[2]: recorder address, zero-padded
      ]
      data:     <bytes>      // empty for this event
    }
  ]
}
```

### What the verifier must NOT do

- Must not parse `log.data` to find the digest — it is in `topics[1]`
- Must not filter logs by contract address alone — must also match the event signature topic
- Must not assume a transaction contains exactly one matching log
- Must not accept a match where `log.topics[0]` is absent or does not equal the event signature hash

---

## Full Cycle: Commit → Verify

The complete OCP cycle for an EVM commitment:

```
Observation (raw bytes)
        ↓
SHA-256(observation) = H
        ↓
record(H) → Recorded(H, recorder) on-chain
        ↓
Proof envelope constructed from receipt
        ↓
Verifier recomputes H' = SHA-256(observation')
        ↓
H' == H  AND  H ∈ R(receipt)
        ↓
VALID
```

If either condition fails, verification fails. No trust assumptions beyond access to a canonical ledger view.

---

## Finality Recommendations

| Chain | chain.id | Recommended depth | Rationale |
|---|---|---|---|
| Ethereum mainnet | `eip155:1` | 12 blocks | ~144 seconds; historically sufficient for re-org safety |
| Base mainnet | `eip155:8453` | 6 blocks | L2 with L1 settlement; lower re-org risk |
| Base Sepolia | `eip155:84532` | 3 blocks | Testnet; use for development only |
| Sepolia | `eip155:11155111` | 6 blocks | Testnet; use for development only |

---

## Supported Chain Registry

| Network | chain.id | chain.namespace | Status |
|---|---|---|---|
| Ethereum mainnet | `eip155:1` | `evm` | Supported |
| Base mainnet | `eip155:8453` | `evm` | Supported |
| Base Sepolia | `eip155:84532` | `evm` | Supported (testnet) |
| Sepolia | `eip155:11155111` | `evm` | Supported (testnet) |

---

## Complete Proof Envelope Example

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
    "transaction_id": "0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd",
    "block_height": 41658348,
    "block_hash": "0x840e71e7815d501c9ed97a8418f00d30b8b9c79943ded56ea7e12e8dca0ab328",
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
```

---

## Relation to existing proof-format-v1

| proof-format-v1 field | Envelope field | Notes |
|---|---|---|
| `hash` | `commitment.digest` | Remove `0x` prefix |
| `txHash` | `ledger_ref.transaction_id` | Same format |
| `network` | `chain.id` | Convert to CAIP-2 (e.g. `base-sepolia` → `eip155:84532`) |
| `contract` | Not in envelope | Implicit in `extraction.rule_id` |
| `extractionRule` | `extraction.rule_id` | Replaced by formal rule registry |
| `timestamp` | `meta.created_utc` | Convert ms epoch to ISO 8601 |
| `fileName` | Not in envelope | Descriptive only; out of scope |
| `version` | `ocp` + `meta.envelope_version` | Split into two versioned fields |

---

## Gate 2 checklist

- [x] A verifier can extract the digest from a raw Base Sepolia transaction receipt without ethers.js or any EVM library
- [x] The event signature topic value can be independently computed from the string `"Recorded(bytes32,address)"`
- [x] The extraction procedure correctly handles transactions with multiple `record()` calls
- [x] The block hash confirmation step is implemented and tested
- [x] At least one real proof envelope has been generated and verified end-to-end against a live Base Sepolia transaction
- [x] The finality depth at time of verification is surfaced to the caller, not silently assumed

---

*Observation Commitment Protocol — docs/spec/appendix-evm-r.md*  
*Original publication: April 5, 2026 — https://ethresear.ch/t/observation-commitment-protocol-ocp-v1-0-0/24602*  
*github.com/damonzwicker/observation-commitment-protocol*


---

## Relation to ERC-8263

ERC-8263 (Onchain Proof Layer for AI Agents) specifies a minimal on-chain commitment interface for AI agents. OCP and ERC-8263 are complementary: ERC-8263 defines how a digest is committed on-chain (write side), OCP defines how that digest is independently verified (read side).

OCP standard extraction rule (evm/event-log) targets the OCP reference contract. A separate extraction rule (evm/erc-8263) is being co-authored with Vincent Wu to read proofHash from AnchorProof log entries directly, pending v1 contract deployment on Sepolia.

ERC-8263 specification: https://github.com/ethereum/ERCs/pull/1748
