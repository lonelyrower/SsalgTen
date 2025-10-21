#!/usr/bin/env node

/**
 * Simple UTF-8 encoding guard.
 *
 * Scans provided globs (or the default frontend source tree) and ensures each
 * matched text file can be decoded as UTF-8 without loss. If a file fails,
 * the script exits with a non-zero code and lists offending paths.
 */

import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import { relative, resolve } from "node:path";
import process from "node:process";

const cwd = process.cwd();

const DEFAULT_PATTERNS = [
  "frontend/src/**/*.{ts,tsx,js,jsx,css,scss,less,json,html,md}",
  "frontend/public/**/*.{json,html,txt}",
];

const IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/build/**",
  "**/.next/**",
];

const patterns = process.argv.slice(2);

async function collectFiles() {
  const files = new Set();
  const targets = patterns.length > 0 ? patterns : DEFAULT_PATTERNS;

  for (const pattern of targets) {
    const iterator = glob(pattern, {
      cwd,
      withFileTypes: false,
      nodir: true,
      ignore: IGNORE,
    });
    for await (const match of iterator) {
      files.add(resolve(cwd, match));
    }
  }

  return [...files];
}

function isUtf8(buffer) {
  if (buffer.length === 0) {
    return true;
  }

  const decoded = buffer.toString("utf8");
  const reencoded = Buffer.from(decoded, "utf8");
  return buffer.equals(reencoded);
}

function formatList(items) {
  return items
    .map((file) => ` - ${relative(cwd, file)}`)
    .join("\n");
}

async function main() {
  const files = await collectFiles();
  const nonUtf8 = [];

  for (const file of files) {
    try {
      const content = readFileSync(file);
      if (!isUtf8(content)) {
        nonUtf8.push(file);
      }
    } catch (error) {
      if (error && error.code === "ENOENT") {
        continue;
      }
      console.error(`无法校验文件编码: ${relative(cwd, file)}`);
      console.error(error);
      process.exitCode = 1;
      return;
    }
  }

  if (nonUtf8.length > 0) {
    console.error("检测到非 UTF-8 编码的文件：");
    console.error(formatList(nonUtf8));
    console.error("\n请将以上文件转换为 UTF-8 后重试。");
    process.exitCode = 1;
    return;
  }
}

main().catch((error) => {
  console.error("编码检查失败：");
  console.error(error);
  process.exitCode = 1;
});
