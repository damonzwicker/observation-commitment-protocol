# OCP v1.0.0 Specification

## Definition

An observation is defined as a byte sequence:

observation ∈ {0,1}*

A digest is computed:

H = hash(observation)

where `hash` is a deterministic cryptographic hash function (e.g., SHA-256) and consistently applied.

A commitment is made by including H in a public ledger transaction such that H is retrievable from the transaction independent of the originating system.

---

## Verification

Given:

- observation′  
- H (committed digest)  
- tx (referenced transaction)  
- R (an extraction rule)

Verification succeeds iff:

H′ = hash(observation′)

H′ == H  
and  
H ∈ R(tx)

---

## Verification Invariant

recompute → compare → confirm inclusion

---

## Assumptions

- hash is deterministic  
- hash is collision-resistant  
- tx is a valid transaction in a public ledger  
- the referenced transaction tx can be resolved and inspected  
- an extraction rule R exists such that H can be obtained from tx  

---

## Scope

OCP defines only the verification boundary.

It does not define:

- storage  
- identity  
- authorship  
- canonical encoding  
- application-layer semantics  
- extraction rules R  

---

## Interpretation

OCP does not prove:

- who created the observation  
- when it was created in real-world time  
- that the observation is true or meaningful  

OCP proves only:

- that a specific digest H was committed to a public ledger  
- that a provided observation produces that same digest  
