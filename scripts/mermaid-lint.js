// Scans Markdown files for mermaid blocks, normalizes, and validates them.

import fs from "node:fs";
import path from "node:path";
import { MermaidSanitizer } from "../src/mermaid/MermaidSanitizer.js";

const ROOT = process.cwd();

function findMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...findMarkdownFiles(full));
    } else if (e.isFile() && e.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

function extractMermaidBlocks(content) {
  const blocks = [];
  const lines = content.split("\n");
  let inBlock = false;
  let current = [];

  for (const line of lines) {
    if (!inBlock && line.trim().startsWith("```mermaid")) {
      inBlock = true;
      current = [];
      continue;
    }
    if (inBlock && line.trim().startsWith("```")) {
      inBlock = false;
      blocks.push(current.join("\n"));
      current = [];
      continue;
    }
    if (inBlock) {
      current.push(line);
    }
  }

  return blocks;
}

function main() {
  const mdFiles = findMarkdownFiles(ROOT);
  const allErrors = [];

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, "utf8");
    const blocks = extractMermaidBlocks(content);
    blocks.forEach((block, idx) => {
      try {
        const normalized = MermaidSanitizer.normalize(block);
        const { ok, errors } = MermaidSanitizer.quickValidate(normalized);
        if (!ok) {
          allErrors.push({
            file,
            blockIndex: idx,
            errors
          });
        }
      } catch (err) {
        allErrors.push({
          file,
          blockIndex: idx,
          errors: [err.message]
        });
      }
    });
  }

  if (allErrors.length > 0) {
    console.error("Mermaid lint failures:");
    for (const e of allErrors) {
      console.error(`\nFile: ${e.file}, Block #${e.blockIndex}`);
      e.errors.forEach(msg => console.error(`  - ${msg}`));
    }
    process.exit(1);
  } else {
    console.log("All Mermaid diagrams passed lint.");
  }
}

if (require.main === module) {
  main();
}
