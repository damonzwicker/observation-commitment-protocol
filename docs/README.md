# Protocol Documentation

This directory contains the formal specification and supporting materials for the Observation Commitment Protocol (OCP).

---

## Overview

OCP defines a minimal verification boundary for independently confirming that a specific byte sequence was committed to a public ledger.

Verification reduces to:

recompute → compare → confirm inclusion

---

## Contents

### 📄 Specification
- /spec/ocp-v1.0.0.md  
  The canonical protocol definition, including the verification model, assumptions, and formal structure.

### 📘 Supporting Documents
Additional materials explaining the protocol, proof format, and usage patterns.

---

## How to Read This

- Start with the Specification for the formal definition  
- Use Examples in /examples to see real proofs  
- Reference Contracts in /contracts for minimal on-chain patterns  

---

## Scope Reminder

OCP defines only the verification boundary.

It does not specify:
- storage
- identity
- authorship
- application-layer behavior

---

## Status

v1.0.0 — Initial Specification Release
