# Observation Commitment Protocol (OCP)

If one byte changes, verification fails — across any chain, any system.

A chain-agnostic primitive for independently verifying that a specific byte sequence was committed to a public ledger.

Minimal. Verifiable. System-independent.

---

## ⚡ 30-Second Demo (start here)

```bash
cd examples/oh-shit-demo
./run-demo.sh
```

Expected:

```
VALID  
INVALID  
```

If one byte changes, verification fails — across any system.

---

## 🔌 Integrate in 2 Minutes

### 1) Commit (produce a proof)

```bash
npx ocp-commit report.txt
```

This automatically creates:

```bash
report.proof.json
```

### 2) Verify (anywhere, later)

```bash
npx ocp-verify report.txt
```

Expected:

```
VALID
```

If any byte changes:

```
INVALID: hash mismatch
```

### 3) Test tampering (optional)

```bash
npx ocp-verify tampered.txt report.proof.json
```

### 4) Use in your system

- Save the file + proof together
- Or store the proof alongside records/logs
- Verification requires only the file and the proof

No API. No platform dependency.

---

## The Problem

Every AI system running today has the same problem.

You can't verify what it did.

Not really. You can ask the platform. You can trust the logs. You can hope the provider is telling the truth. But there is no independent, tamper-proof record of what an AI received, what it produced, and whether anything was changed in between.

Most digital systems can prove things — but only **inside themselves**.

Step outside the system, and verification depends on:
- APIs
- platforms
- intermediaries

OCP eliminates that dependency entirely.

---

## Where This Breaks Without OCP

- AI outputs cannot be independently verified
- Legal evidence depends on originating systems
- APIs and platforms are non-permanent
- Digital artifacts become disputable over time

Without a system-independent verification boundary,
"what actually happened" becomes ambiguous.

---

## Use Cases

OCP can be used anywhere a digital artifact may need to be independently verified later:

- AI outputs and execution traces
- Legal evidence and filings
- Audit logs and compliance records
- Media provenance
- File integrity
- Institutional records

### Example: Verifying an AI Output

An AI system generates a report:

```text
AI Risk Assessment: MEDIUM_RISK
Approved for internal review.
```

That output is committed using OCP.

Later, the report is modified:

```text
AI Risk Assessment: LOW_RISK
Approved for internal review.
```

Using the original proof:

- the original output verifies as VALID
- the modified output returns INVALID

The difference is one word.

Verification does not depend on the AI system, API, or platform.

It depends only on the bytes.

---

## The Protocol

An observation is any byte sequence.

```
data → digest → public commitment
```

Verification reduces to:

```
recompute → compare → confirm inclusion
```

A verifier:
- recomputes the digest
- compares it to the committed value
- confirms that the digest exists in a referenced transaction

No API. No platform dependency. No trust in the originating system.

---

## Proof Envelope

OCP proofs are self-describing, chain-agnostic JSON artifacts. A valid proof envelope is verifiable against raw ledger data — no SDK, no RPC provider, no indexer required.

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
    "block_hash": "0x...",
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

---

## Reference Implementation — Live on Base Sepolia

Contract: `0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c`

```solidity
contract ObservationCommitment {
    event Recorded(bytes32 indexed digest, address indexed recorder);

    function record(bytes32 digest) external {
        emit Recorded(digest, msg.sender);
    }
}
```

Live verification — zero dependencies, Node.js stdlib only:

```
  hash      MATCH  14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73
  chain     eip155:84532
  rpc       https://sepolia.base.org
  tx        0xf2e1f6c085768b4e3d60463717d52bb2a338803a74a4cfd48aea5738d2595ddd
  logs      found 1 Recorded event(s)
  digest    MATCH  14cca453684a18c1ef3e1c0b9a7744cfa06942660719bba373ef5fc36208bf73

VALID
```

---

## What OCP Defines

- A minimal verification model
- A system-independent verification boundary
- A portable, self-describing proof envelope (chain-agnostic)
- A formal extraction rule registry (`evm/event-log`, `solana/instruction-data`)

---

## What OCP Does Not Define

- Storage
- Identity
- Authorship
- Canonical encoding
- Application-layer semantics
- Sanitization or preprocessing pipelines

---

## In the Wild

OCP is being adopted as the Layer 3 commitment primitive in the ERC-8004 Universal AI Inference Verification Registry stack:

```
L2 — input provenance:  raw → sanitize → commit
L3 — OCP:              digest → on-chain → verify from raw block
L4 — EIP-712 signed inference attestation
L5 — registry routes to zkML / opML / TEE
```

The identity pipeline sentinel hash has been confirmed between two independent implementations:

```
8116eec29078e8f57c07077d5e8080a35bde73036581df3abb93755d1b1a16ea
```

Thread: https://ethereum-magicians.org/t/draft-erc-universal-ai-inference-verification-registry/28083/20

---

## Why It Matters

OCP separates **verification from systems**.

A verifier does not ask what's true —
they compute it.

The network only confirms that a commitment exists.

---

## Start Here

- 📄 Core Specification → `/docs/spec/ocp-v1.0.0.md`
- 🗂️ Proof Envelope → `/docs/spec/ocp-proof-envelope-v1.0.0.md`
- ⛓️ EVM Extraction Rule → `/docs/spec/appendix-evm-r.md`
- 🧾 Proof Format → `/docs/spec/proof-format-v1.md`
- 🔍 Examples → `/examples`
- ⚙️ Contracts → `/contracts`
- 🌐 Live Demo → https://observation-commitment-protocol.vercel.app/

Reference implementation (VeraFile):
https://github.com/damonzwicker/verafile

---

## Quick Verify

```bash
npx ocp-verify examples/example-observation.txt
```

Expected output:

```
VALID
```

---

## Status

v1.0.0 — Cross-Chain Primitive  
Phase 2 complete — EVM reference implementation live  
Phase 3 in progress — Solana appendix
