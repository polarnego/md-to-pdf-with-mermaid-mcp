#!/usr/bin/env node
/*
 * Render Mermaid code blocks in a Markdown file to SVGs,
 * replace them with image links, then export the Markdown to PDF.
 *
 * Usage:
 *   node scripts/md_mermaid_to_pdf.js <input.md> <output.pdf>
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';

function run(cmd) {
  execSync(cmd, { stdio: 'pipe' });
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export function convertMarkdownWithMermaidToPdf(inputMd, outputPdf) {
  const inputAbs = path.resolve(inputMd);
  const outputAbs = path.resolve(outputPdf);
  const docsDir = path.dirname(inputAbs);
  const outDir = path.join(docsDir, '.out');
  ensureDir(outDir);

  const md = fs.readFileSync(inputAbs, 'utf8');
  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
  let match;
  let index = 0;
  let renderedMd = md;

  // Collect replacements to avoid messing indices while replacing
  const replacements = [];
  while ((match = mermaidRegex.exec(md)) !== null) {
    index += 1;
    const code = match[1];
    const base = `diagram_${index}`;
    const mmdPath = path.join(outDir, `${base}.mmd`);
    const svgPath = path.join(outDir, `${base}.svg`);
    fs.writeFileSync(mmdPath, code, 'utf8');

    // Render to SVG via mermaid-cli
    run(`npx -y @mermaid-js/mermaid-cli -i '${mmdPath}' -o '${svgPath}' -t neutral`);

    const imgMarkdown = `![](${path.relative(outDir, svgPath)})`;
    const replacement = imgMarkdown;
    replacements.push({ from: match[0], to: replacement });
  }

  // Apply replacements
  for (const r of replacements) {
    renderedMd = renderedMd.replace(r.from, r.to);
  }

  const renderedMdPath = path.join(outDir, path.basename(inputAbs).replace(/\.md$/, '.rendered.md'));
  fs.writeFileSync(renderedMdPath, renderedMd, 'utf8');

  // Convert to PDF (try md-to-pdf without explicit output, then move file; fallback to pandoc)
  let producedPdf;
  try {
    run(`npx -y md-to-pdf '${renderedMdPath}'`);
    producedPdf = renderedMdPath.replace(/\.md$/, '.pdf');
    if (!fs.existsSync(producedPdf)) {
      throw new Error(`Expected output not found: ${producedPdf}`);
    }
    ensureDir(path.dirname(outputAbs));
    fs.copyFileSync(producedPdf, outputAbs);
  } catch (e) {
    try {
      run(`pandoc -f gfm -o '${outputAbs}' '${renderedMdPath}'`);
    } catch (e2) {
      console.error('Failed to convert to PDF with both md-to-pdf and pandoc');
      process.exit(2);
    }
  }

  if (!process.env.MCP_SILENT) {
    console.log(`PDF written: ${outputAbs}`);
  }
  return outputAbs;
}

function main() {
  const [inputMd, outputPdf] = process.argv.slice(2);
  if (!inputMd || !outputPdf) {
    console.error('Usage: node scripts/md_mermaid_to_pdf.js <input.md> <output.pdf>');
    process.exit(1);
  }

  convertMarkdownWithMermaidToPdf(inputMd, outputPdf);
}

// ESM CLI entry guard
try {
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
  }
} catch {}


