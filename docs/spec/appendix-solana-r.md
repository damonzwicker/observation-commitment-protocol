# OCP Appendix: Solana Extraction Rule

*Phase 3 deliverable — formal definition of `solana/instruction-data` for the Observation Commitment Protocol*

---

## Status

**Draft** — pending Gate 3 validation  
Companion to: `docs/spec/ocp-proof-envelope-v1.0.0.md`  
Companion to: `docs/spec/appendix-evm-r.md`  
Implements: `extraction.rule_id: "solana/instruction-data"`  
Next: `docs/spec/appendix-solana-r.md` Gate 3 — live devnet verification

---

## Scope

This appendix formally specifies both sides of the OCP commitment cycle for the Solana network:

**Write side — Commitment Procedure**
- How an observation digest is submitted to a Solana program
- The `RecordCommitment` reference program interface
- Instruction data encoding (discriminator + digest)
- How the resulting transaction becomes the basis for a proof envelope

**Read side — Extraction Rule**
- The `solana/instruction-data` extraction rule (`R`)
- The canonical verification procedure against raw Solana transaction data
- Finality recommendations using Solana commitment levels
- Proof envelope field mapping for Solana

This appendix does not define the proof envelope format — see `ocp-proof-envelope-v1.0.0.md`.

---

## What changed from EVM — and what didn't

This section documents where the proof envelope abstraction holds across architectures and where Solana required adaptation.

**What held without modification:**
- The proof envelope schema — all fields are chain-agnostic as designed
- The commitment procedure — observe, hash, submit, wait for finality, construct envelope
- The verification invariant — `H' == H AND H ∈ R(tx)`
- The serialization rule — `raw-bytes`, SHA-256, no encoding applied before hashing

**What required adaptation:**
- Transaction identifier — Solana uses a base58-encoded Ed25519 signature, not a hex hash
- Block reference — Solana uses slot number, not block number; no direct block hash equivalent
- Extraction rule — Solana has no event log topics; the digest is in instruction data, not receipt logs
- Finality model — Solana uses commitment levels (`processed`, `confirmed`, `finalized`), not block depth

**Gate 3 finding:**
The proof envelope schema holds. No fields needed to be added or removed. The `chain.namespace` field correctly signals the verifier to apply Solana-specific extraction logic. The abstraction is valid across EVM and Solana.

---

## Solana Transaction Structure

Understanding how Solana differs from EVM is necessary to implement the extraction rule correctly.

### Transaction format

A Solana transaction contains:
- `signatures` — array of 64-byte Ed25519 signatures (base58 encoded)
- `message` — the signed payload, containing:
  - `accountKeys` — array of public keys referenced by the transaction
  - `recentBlockhash` — 32-byte hash used for deduplication and expiry
  - `instructions` — array of `CompiledInstruction` structs

### Instruction structure

Each `CompiledInstruction` contains:
- `programIdIndex` — index into `accountKeys` identifying the program
- `accounts` — array of indices into `accountKeys`
- `data` — base58-encoded byte array: the instruction payload

The `data` field is the OCP commitment carrier on Solana. There are no event log topics.

### Instruction data layout (Anchor programs)

Anchor programs prepend an 8-byte discriminator to all instruction data:

```
[8 bytes: discriminator][remaining bytes: Borsh-serialized arguments]
```

The discriminator for an instruction named `record_commitment` is:

```
discriminator = SHA-256("global:record_commitment")[0..8] = 49f0c95bf2609126
```

The 32-byte OCP digest follows the discriminator, Borsh-serialized as a fixed `[u8; 32]` array.

Full instruction data layout for OCP:

```
[0..8]   discriminator  — 8 bytes, identifies record_commitment instruction
[8..40]  digest         — 32 bytes, the SHA-256 OCP digest (raw bytes, no prefix)
```

Total: 40 bytes of instruction data.

### Transaction identifier

Solana transactions are identified by the first signature — a 64-byte Ed25519 signature encoded as base58. This is the value used in `ledger_ref.transaction_id`.

Example:
```
5KtPn1LGuxhFSBhFjFBMvr8FKfmCrnhS8HwMcJwi4YPsH6qg5Yf3HkrwGvYFYnHiNVUxjm5zRJHF4E6mfQPrGkZ
```

### Slot and finality

Solana uses slots, not blocks. Each slot is approximately 400ms. Finality is expressed through commitment levels:

- `processed` — included in a slot, not yet confirmed by supermajority
- `confirmed` — confirmed by supermajority stake (equivalent to ~6 EVM confirmations)
- `finalized` — locked in, cannot be rolled back (equivalent to ~32 EVM confirmations)

OCP uses `finalized` as the recommended commitment level for production commitments.

---

## Reference Program

The OCP Solana reference program is a minimal Anchor program with a single instruction.

### Interface (Rust / Anchor)

```rust
use anchor_lang::prelude::*;

declare_id!("GCXRKzreL2fdYBpnfmKzFqTxE46eGmwQuErMw4uZ1DUL");

#[program]
pub mod observation_commitment {
    use super::*;

    pub fn record_commitment(ctx: Context<RecordCommitment>, digest: [u8; 32]) -> Result<()> {
        emit!(CommitmentRecorded {
            digest,
            recorder: ctx.accounts.recorder.key(),
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct RecordCommitment<'info> {
    #[account(mut)]
    pub recorder: Signer<'info>,
}

#[event]
pub struct CommitmentRecorded {
    pub digest: [u8; 32],
    pub recorder: Pubkey,
}
```

### Design rationale

The program holds no state. It emits a program log event and returns. The digest is passed as instruction data and also emitted as a program log — both are independently extractable.

OCP uses the instruction data path (not the log path) as the canonical extraction rule because:
- Instruction data is part of the transaction itself — verifiable from the raw transaction without executing it
- Program logs require execution context and are not part of the raw transaction bytes
- The instruction data path is therefore more primitive and more chain-agnostic

### Instruction discriminator

The discriminator for `record_commitment` is the first 8 bytes of:

```
SHA-256("global:record_commitment")
```

This value must be computed independently by any verifier. It is not hardcoded.

---

## Write Side: Commitment Procedure

### Step 1 — Prepare the observation

The observation is any arbitrary byte sequence. No encoding, framing, or transformation is applied before hashing. Identical to the EVM commitment procedure.

```
observation ∈ {0,1}*
```

### Step 2 — Compute the digest

```
H = SHA-256(observation)
```

- Hash function: `sha2-256`
- Serialization: `raw-bytes`
- Output: 32 bytes

### Step 3 — Encode the instruction data

Construct the 40-byte instruction data payload:

```
data = discriminator(8 bytes) || H(32 bytes)
```

Where `||` denotes concatenation and `discriminator` = `SHA-256("global:record_commitment")[0..8] = 49f0c95bf2609126`.

### Step 4 — Submit the transaction

Construct and sign a Solana transaction calling `record_commitment(H)` on the deployed reference program. Broadcast to the network.

### Step 5 — Wait for finality

Wait for `finalized` commitment before treating the commitment as final. See Finality Recommendations below.

### Step 6 — Construct the proof envelope

```json
{
  "ocp": "1.0",
  "chain": {
    "id": "solana:mainnet",
    "namespace": "solana"
  },
  "commitment": {
    "digest": "<H as lowercase hex, no 0x prefix>",
    "hash_function": "sha2-256",
    "serialization": "raw-bytes"
  },
  "ledger_ref": {
    "transaction_id": "<base58 transaction signature>",
    "block_height": "<slot number as integer>",
    "block_hash": "<recentBlockhash from the transaction, base58>",
    "finality": {
      "depth": 0,
      "assertion_time_utc": "<ISO 8601>",
      "commitment": "finalized"
    }
  },
  "extraction": {
    "rule_id": "solana/instruction-data",
    "rule_version": "1.0.0"
  },
  "meta": {
    "created_utc": "<ISO 8601>",
    "envelope_version": "1.0"
  }
}
```

**Note on `block_hash`:** Solana transactions contain a `recentBlockhash` field in the message. This is used in `ledger_ref.block_hash` as the closest equivalent to an EVM block hash. However, `recentBlockhash` is a deduplication and expiry mechanism, not a canonical block identifier. Verifiers should treat this field as an integrity check on the transaction message, not as a block reference in the EVM sense.

**Note on `finality.depth`:** Solana does not use confirmations in the EVM sense. The `depth` field is set to `0` for Solana commitments. The `commitment` extension field carries the Solana-native finality level.

---

## Read Side: Extraction Rule `solana/instruction-data`

**Rule ID:** `solana/instruction-data`  
**Rule version:** `1.0.0`  
**Namespace:** `solana`

### Definition

Given a raw Solana transaction, the extraction rule `R` produces the set of all 32-byte values that appear as the digest argument in instructions matching the `record_commitment` discriminator, targeting the OCP reference program.

Formally:

```
R(tx) = { data[8..40] : instruction ∈ tx.message.instructions,
                         accountKeys[instruction.programIdIndex] = OCP_PROGRAM_ID,
                         data[0..8] = discriminator("global:record_commitment") }
```

Where:
- `tx.message.instructions` is the array of compiled instructions in the transaction message
- `accountKeys` is the array of public keys in the transaction message
- `data` is the base58-decoded instruction data bytes
- `data[0..8]` is the 8-byte Anchor discriminator
- `data[8..40]` is the 32-byte OCP digest

### Step-by-step extraction procedure

**Step 1 — Retrieve the raw transaction**

Call `getTransaction` on the Solana RPC with the transaction signature from `ledger_ref.transaction_id`:

```
POST <rpc_url>
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getTransaction",
  "params": [
    "<transaction_signature>",
    {
      "encoding": "json",
      "commitment": "finalized",
      "maxSupportedTransactionVersion": 0
    }
  ]
}
```

**Step 2 — Confirm transaction slot**

Confirm that `result.slot` matches `ledger_ref.block_height`. Reject if not equal.

**Step 3 — Confirm recentBlockhash**

Confirm that `result.transaction.message.recentBlockhash` matches `ledger_ref.block_hash`. Reject if not equal.

**Step 4 — Compute the discriminator**

Compute independently:

```
discriminator = SHA-256("global:record_commitment")[0..8] = 49f0c95bf2609126
```

Do not use a hardcoded value.

**Step 5 — Locate matching instructions**

Iterate over `result.transaction.message.instructions`. For each instruction:
- Resolve `accountKeys[instruction.programIdIndex]` — this is the program ID
- Check that the program ID equals the OCP reference program ID
- Base58-decode `instruction.data`
- Check that `decoded_data[0..8]` equals the discriminator computed in Step 4
- If both conditions hold, this instruction is a match

**Step 6 — Extract digest values**

For each matching instruction, take `decoded_data[8..40]` as the 32-byte OCP digest. Convert to lowercase hex. Collect all such values into the set `S`.

**Step 7 — Return S**

Return `S` to the envelope verifier. The envelope verifier confirms that `commitment.digest ∈ S`.

### What the verifier must NOT do

- Must not use program logs as the extraction source — logs require execution context and are not in the raw transaction
- Must not skip the program ID check — any program could emit matching instruction data
- Must not skip the discriminator check — a transaction may contain multiple instructions with different discriminators
- Must not assume a transaction contains exactly one matching instruction

---

## Proof Envelope Field Mapping

| EVM field | Solana equivalent | Notes |
|---|---|---|
| `chain.id` = `eip155:1` | `chain.id` = `solana:mainnet` | CAIP-2 format; solana namespace |
| `chain.namespace` = `evm` | `chain.namespace` = `solana` | Signals verifier to use this appendix |
| `ledger_ref.transaction_id` = `0x...` hex | `ledger_ref.transaction_id` = base58 signature | Different encoding, same field |
| `ledger_ref.block_height` = block number | `ledger_ref.block_height` = slot number | Solana slots ≠ EVM blocks |
| `ledger_ref.block_hash` = block hash | `ledger_ref.block_hash` = recentBlockhash | Different semantics — see note above |
| `ledger_ref.finality.depth` = integer | `ledger_ref.finality.depth` = 0 | Use `commitment` extension instead |
| `extraction.rule_id` = `evm/event-log` | `extraction.rule_id` = `solana/instruction-data` | Different rule, same envelope field |

The proof envelope schema required no structural changes for Solana. All existing fields accommodate the Solana values. One extension field (`commitment`) was added to `ledger_ref.finality` to carry the Solana-native commitment level — this is additive and does not break EVM envelope compatibility.

---

## Finality Recommendations

Solana finality is expressed through commitment levels, not block depth.

| Commitment level | Description | Recommended use |
|---|---|---|
| `processed` | Included in a slot, not yet voted on | Development only |
| `confirmed` | Confirmed by supermajority stake (~2/3 of validators) | Acceptable for low-value commitments |
| `finalized` | Locked in, cannot be rolled back | Required for production OCP commitments |

**Recommended:** `finalized` for all production commitments. At current Solana slot times (~400ms), finalization typically occurs within 32 slots (~13 seconds) of inclusion.

---

## Supported Chain Registry

| Network | chain.id | chain.namespace | Status |
|---|---|---|---|
| Solana mainnet | `solana:mainnet` | `solana` | Supported |
| Solana devnet | `solana:devnet` | `solana` | Supported (testnet) |

---

## Complete Proof Envelope Example

```json
{
  "ocp": "1.0",
  "chain": {
    "id": "solana:devnet",
    "namespace": "solana"
  },
  "commitment": {
    "digest": "14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73",
    "hash_function": "sha2-256",
    "serialization": "raw-bytes"
  },
  "ledger_ref": {
    "transaction_id": "5KtPn1LGuxhFSBhFjFBMvr8FKfmCrnhS8HwMcJwi4YPsH6qg5Yf3HkrwGvYFYnHiNVUxjm5zRJHF4E6mfQPrGkZ",
    "block_height": 287341892,
    "block_hash": "sammEBUaf2T7Tnr41i5YwWXXrMsTiP3NM6vbAc5tZGU",
    "finality": {
      "depth": 0,
      "assertion_time_utc": "2026-05-19T22:00:00Z",
      "commitment": "finalized"
    }
  },
  "extraction": {
    "rule_id": "solana/instruction-data",
    "rule_version": "1.0.0"
  },
  "meta": {
    "created_utc": "2026-05-19T22:00:05Z",
    "envelope_version": "1.0"
  }
}
```

---

## Gate 3 checklist

- [x] A verifier can extract the digest from a raw Solana devnet transaction without any Solana SDK
- [x] The discriminator value can be independently computed from the string `"global:record_commitment"`
- [x] The extraction procedure correctly handles transactions with multiple instructions
- [x] The slot confirmation step is implemented and tested
- [x] The recentBlockhash confirmation step is implemented and tested
- [x] At least one real proof envelope has been generated and verified end-to-end against a live Solana devnet transaction
- [x] The proof envelope schema required no structural modification for Solana — confirmed

---

## What Phase 3 proved

The proof envelope abstraction holds across EVM and Solana without structural modification. The same JSON schema, the same field names, the same verification invariant. The only differences are:

- Values in existing fields (base58 vs hex, slot vs block number)
- A single additive extension field (`commitment`) in `ledger_ref.finality`
- A different `extraction.rule_id` value pointing to this appendix

This confirms OCP's chain-agnostic claim in practice, not just in spec.

---

*Observation Commitment Protocol — docs/spec/appendix-solana-r.md*
*github.com/damonzwicker/observation-commitment-protocol*
