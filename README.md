# Observation Commitment Protocol (OCP)

If one byte changes, verification fails — across any system.

A minimal protocol for independently verifying that a specific byte sequence was committed to a public ledger.

Minimal. Verifiable. System-independent.

---

## ⚡ 30-Second Demo (start here)

```bash
cd examples/oh-shit-demo
./run-demo.sh
```

Expected:

VALID  
INVALID  

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

Most digital systems can prove things—  
but only **inside themselves**.

Step outside the system, and verification depends on:
- APIs  
- platforms  
- intermediaries  

There is no standard way to verify something **independently**.

---

## Where This Breaks Without OCP

AI outputs cannot be independently verified  
Legal evidence depends on originating systems  
APIs and platforms are non-permanent  
Digital artifacts become disputable over time  

Without a system-independent verification boundary,  
“what actually happened” becomes ambiguous.

---

## Use Cases

OCP can be used anywhere a digital artifact may need to be independently verified later:

- AI outputs and execution traces  
- legal evidence and filings  
- audit logs and compliance records  
- media provenance  
- file integrity  
- institutional records  

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

This is the same scenario demonstrated in the 30-second demo above.

---

## The Protocol

An observation is any byte sequence.

data → digest → public commitment

Verification reduces to:

recompute → compare → confirm inclusion

A verifier:
- recomputes the digest  
- compares it to the committed value  
- confirms that the digest exists in a referenced transaction  

No API. No platform dependency. No trust in the originating system.

---

## What OCP Defines

- A minimal verification model  
- A system-independent verification boundary  
- A portable verification artifact (digest + transaction reference)  

---

## What OCP Does Not Define

- storage  
- identity  
- authorship  
- canonical encoding  
- application-layer semantics  
- a canonical extraction rule  

---

## Why It Matters

OCP separates **verification from systems**.

A verifier does not ask what’s true—  
they compute it.

The network only confirms that a commitment exists.

---

## Start Here

- 📄 Core Specification → /docs/spec/ocp-v1.0.0.md  
- 🧾 Proof Format → /docs/spec/proof-format-v1.md  
- 🔍 Examples → /examples  
- ⚙️ Contracts → /contracts  
- 🌐 Live Demo → https://observation-commitment-protocol.vercel.app/  

Reference implementation (VeraFile):  
https://github.com/damonzwicker/verafile

---

## Quick Verify

```bash
npx ocp-verify examples/example-observation.txt
```

Expected output:

VALID

---

## Status

v1.0.0 — Initial Specification Release