# OCP Appendix: AI Inference Attestation

*Companion to `ocp-v1.0.0.md` and `appendix-evm-r.md`*

---

## Status

**Draft** — live reference implementation at `gateway.ensub.org`

---

## Scope

This appendix defines how OCP fits into a multi-layer AI inference verification stack. It specifies:

- How `input_hash` is derived and committed to OCP (Layer 3)
- The EIP-712 `InferenceAttestation` struct that signs over all provenance hashes (Layer 4)
- How the two layers are decoupled and independently verifiable
- The identity sentinel for no-op sanitization pipelines

This appendix does not modify the OCP core spec. OCP remains a generic commitment primitive; this document defines one application of it.

---

## Layer Architecture

```
L2 — Input Provenance
     raw_input_hash             SHA-256 of input as received
     sanitization_pipeline_hash SHA-256 of the sanitization spec applied
     input_hash                 SHA-256 of input after sanitization

L3 — OCP Commitment (this appendix)
     record(input_hash)         committed to a public ledger via OCP

L4 — Inference Attestation (this appendix)
     EIP-712 signature over all L2 hashes + output + manifest + on-chain identity

L5 — Output Verification
     manifest_hash routes to verifier (zkML / opML / TEE)
```

L3 and L4 are fully decoupled. An operator may:
- Produce a L4 signature without submitting to L3
- Submit to L3 without signing
- Do both (reference implementation does both)

---

## Layer 3: OCP Commitment

The digest committed to OCP is `input_hash` — the SHA-256 of the sanitized input that was passed to the model.

### Commitment

```
digest = SHA-256(sanitized_input)
record(digest)  →  Recorded(digest, recorder)  on-chain
```

### Verification

Given `input_hash` and a transaction reference `tx`:

```
H′ = SHA-256(sanitized_input′)
H′ == input_hash
input_hash ∈ R(tx)          (using extraction rule evm/event-log)
```

Verification succeeds iff both conditions hold.

### Chain selection

OCP is chain-agnostic. The `ObservationCommitment` contract (defined in `appendix-evm-r.md`) can be deployed on any EVM-compatible chain. The reference implementation uses Base Sepolia; production deployments should use a chain appropriate for their finality and cost requirements.

Reference deployment — Base Sepolia: `0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c`

The verifier must know which chain to query. Implementations SHOULD include a `l3_chain` field (EIP-155 chain ID) alongside `l3_tx` in the attestation response so verifiers can route to the correct RPC without out-of-band coordination.

Parallel anchoring across multiple chains is valid — each `record(input_hash)` call produces an independent proof. A verifier satisfies L3 if `input_hash ∈ R(tx)` holds on *any* declared chain.

---

## Layer 4: EIP-712 Inference Attestation

### Domain

```json
{
  "name":              "KYA-L4",
  "version":           "1",
  "chainId":           1,
  "verifyingContract": "<ERC-8004 registry address>"
}
```

### Typed Struct

```solidity
struct InferenceAttestation {
  bytes32 raw_input_hash;             // SHA-256 of input before sanitization
  bytes32 sanitization_pipeline_hash; // SHA-256 of canonical pipeline spec
  bytes32 input_hash;                 // SHA-256 of input after sanitization
  bytes32 output_hash;                // SHA-256 of model output
  bytes32 manifest_hash;              // SHA-256 of agent manifest
  uint256 agentId;                    // ERC-8004 token ID
  address registry;                   // ERC-8004 registry contract
  uint64  timestamp;                  // Unix timestamp of execution (seconds)
}
```

### Field Semantics

| Field | Layer | Description |
|---|---|---|
| `raw_input_hash` | L2 | Digest of unmodified input as received |
| `sanitization_pipeline_hash` | L2 | Digest of the pipeline spec applied. MUST be the identity sentinel when no transformation runs |
| `input_hash` | L2 | Digest of input after pipeline. Equals `raw_input_hash` when sentinel is used |
| `output_hash` | L4 | Digest of model response |
| `manifest_hash` | L4 | Digest of `{ id, model, provider, input_sources, trust_scope }` |
| `agentId` | L4 | Links attestation to ERC-8004 on-chain identity |
| `registry` | L4 | Resolves signer: `registry.getAgentWallet(agentId)` |
| `timestamp` | L4 | Execution time for replay detection |

### Signer Resolution

```solidity
address expected  = registry.getAgentWallet(agentId);
address recovered = ecrecover(eip712Digest, v, r, s);
require(recovered == expected, "invalid attestation");
```

No trusted third party. Verifier only needs the registry address and the public EIP-712 struct.

---

## Identity Sentinel

When no sanitization is applied, `sanitization_pipeline_hash` MUST be:

```
0x8116eec29078e8f57c07077d5e8080a35bde73036581df3abb93755d1b1a16ea
```

SHA-256 of the canonical identity pipeline spec. When present:
- `input_hash == raw_input_hash`
- verifiers skip sanitization verification entirely

---

## Attestation Endpoint

A gateway implementing this appendix SHOULD expose attestations at:

```
GET /{registry}/{agentId}/attestations
```

Response shape:

```json
{
  "registry":                   "0x...",
  "agent_id":                   "5",
  "action_type":                "chat",
  "raw_input_hash":             "...",
  "sanitization_pipeline_hash": "8116eec2...1a16ea",
  "input_hash":                 "...",
  "output_hash":                "...",
  "manifest_hash":              "...",
  "l4_signature":               "0x...",
  "l3_tx":                      "0x...",
  "l3_chain":                   84532
}
```

`l3_tx` is the transaction hash of the `record(input_hash)` call on OCP. `l3_chain` is the EIP-155 chain ID of the chain where the commitment was made. Both MAY be null if L3 anchoring is not configured. Multiple `(l3_tx, l3_chain)` pairs MAY be present if the operator anchors across several chains.

---

## Live Reference Implementation

**Gateway:** `https://gateway.ensub.org`

**Example attestation:**

```
GET https://gateway.ensub.org/agent/0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d/5/attestations?limit=1
```

```json
{
  "registry":     "0xe61f5a6783ae09949b9a1b6821b68f89c0d7bb2d",
  "agent_id":     "5",
  "input_hash":   "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "l4_signature": "0xd3eb65203317d3775ef25dc22328ea4bd82624b8836d590706f4ad578efb43006ba4cdc4df3686ca9f0960b033306696ae0adcc85f7034dec9781e4e227d45681b",
  "l3_tx":        "0xc3aeb16d0aef167e2ebc6d4afc9333fcd13a71b8c02e5485bc6be7491e393319"
}
```

**L3 tx on Base Sepolia:**
`https://sepolia.basescan.org/tx/0xc3aeb16d0aef167e2ebc6d4afc9333fcd13a71b8c02e5485bc6be7491e393319`

Signer (`0x85Fa13511D170FBe173761b63D7f8DD4A6f6Bf1A`) is registered on-chain as `getAgentWallet(5)` on the ERC-8004 registry — verifiable now.

---

## Author

dinamic.eth
