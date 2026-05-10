# Observation Commitment Protocol (OCP)

A minimal protocol for independently verifying that a specific byte sequence was committed to a public ledger.

Minimal. Verifiable. System-independent.

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

- 📄 Specification → /docs/spec/ocp-v1.0.0.md  
- 🔍 Examples → /examples  
- ⚙️ Contracts → /contracts  
- 🌐 Live Demo → https://observation-commitment-protocol.vercel.app/  

---

## Reference Implementation

VeraFile is the reference implementation of OCP:

https://github.com/damonzwicker/verafile

It provides:
- CLI verification  
- hosted verification  
- production tooling  

OCP defines the protocol.  
VeraFile implements it.

---

## Status

v1.0.0 — Initial Specification Release
