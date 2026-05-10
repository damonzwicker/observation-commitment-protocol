#!/usr/bin/env node

const fs = require("fs");
const crypto = require("crypto");

const [, , filePath, proofArg] = process.argv;

if (!filePath) {
  console.error("Usage: ocp-commit <file> [proof.json]");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`ERROR: file not found: ${filePath}`);
  process.exit(1);
}

const proofPath =
  proofArg ||
  filePath.replace(/(\.[^/.]+)?$/, ".proof.json");

const fileBytes = fs.readFileSync(filePath);
const hash = "0x" + crypto.createHash("sha256").update(fileBytes).digest("hex");

const proof = {
  version: "ocp-1",
  hash,
  txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  network: "demo-local",
  contract: "0x0000000000000000000000000000000000000000",
  extractionRule: "demo:proof.hash"
};

fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + "\n");

console.log("COMMITTED: proof created");
console.log(`file:  ${filePath}`);
console.log(`proof: ${proofPath}`);
console.log(`hash:  ${hash}`);