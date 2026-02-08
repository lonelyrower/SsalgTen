#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const exists = (p) => fs.existsSync(path.join(ROOT, p));

const readText = (p) =>
  fs.readFileSync(path.join(ROOT, p), { encoding: "utf8" });

const failures = [];
const warn = [];

const assert = (cond, msg) => {
  if (!cond) failures.push(msg);
};

// --- Required files ---
assert(exists("LICENSE"), "Missing LICENSE (MIT license is referenced in README/package.json)");
assert(
  exists("docs/WSL2_DOCKER_FIX.md"),
  "Missing docs/WSL2_DOCKER_FIX.md (README links to it)",
);
assert(
  exists("docs/PRODUCTION_UPDATE.md"),
  "Missing docs/PRODUCTION_UPDATE.md (scripts/test-update-system.sh links to it)",
);
assert(
  exists("scripts/update-production.sh"),
  "Missing scripts/update-production.sh (updater expects it)",
);
assert(
  exists("scripts/updater-server.mjs"),
  "Missing scripts/updater-server.mjs (Dockerfile.updater copies it)",
);

// --- .dockerignore sanity (updater build context) ---
if (exists(".dockerignore")) {
  const di = readText(".dockerignore");
  assert(
    di.includes("!scripts/updater-server.mjs"),
    ".dockerignore must unignore scripts/updater-server.mjs for Dockerfile.updater COPY to work",
  );
} else {
  warn.push("No .dockerignore found; Docker build context may be larger than necessary.");
}

// --- Engines alignment ---
const pkgs = [
  { name: "root", file: "package.json" },
  { name: "backend", file: "backend/package.json" },
  { name: "agent", file: "agent/package.json" },
];

for (const p of pkgs) {
  if (!exists(p.file)) continue;
  const json = JSON.parse(readText(p.file));
  const nodeEngine = json?.engines?.node;
  assert(
    typeof nodeEngine === "string" && nodeEngine.includes("22"),
    `${p.name} engines.node should target Node 22+ (got ${JSON.stringify(nodeEngine)})`,
  );
}

// --- Build outputs (CI runs build before smoke test) ---
if (!exists("frontend/dist/index.html")) {
  failures.push(
    "Missing frontend/dist/index.html (did you run `npm run build:frontend`?)",
  );
}
if (!exists("backend/dist/server.js")) {
  failures.push(
    "Missing backend/dist/server.js (did you run `npm run build:backend`?)",
  );
}

if (warn.length) {
  console.warn("[smoke-test] warnings:");
  for (const w of warn) console.warn(`- ${w}`);
}

if (failures.length) {
  console.error("[smoke-test] failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("[smoke-test] ok");
