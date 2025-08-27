#!/usr/bin/env node
/*
 * MCP server exposing a tool to convert Markdown (with Mermaid code blocks)
 * to PDF using the existing conversion logic.
 *
 * This server communicates over stdio, suitable for MCP clients to run via npx.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

import { convertMarkdownWithMermaidToPdf } from './md_mermaid_to_pdf.js';

async function start() {
  // Signal converter to be silent on stdout when running under MCP
  process.env.MCP_SILENT = process.env.MCP_SILENT || '1';
  const server = new McpServer({ name: 'md-mermaid-to-pdf', version: '1.0.0' });

  server.tool(
    'convert_markdown_to_pdf',
    'Convert a Markdown file (with ```mermaid code blocks) to a PDF.',
    z.object({
      inputPath: z.string().describe('Absolute path to input .md file'),
      outputPath: z.string().describe('Absolute path to output .pdf file'),
    }),
    async ({ inputPath, outputPath }) => {
      if (!path.isAbsolute(inputPath) || !path.isAbsolute(outputPath)) {
        throw new Error('inputPath and outputPath must be absolute paths.');
      }
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      const produced = convertMarkdownWithMermaidToPdf(inputPath, outputPath);
      return {
        content: [{ type: 'text', text: `PDF written: ${produced}` }],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep the process alive while waiting for MCP client over stdio
  await new Promise(() => {});
}

// CLI mode: if two positional args are provided, run conversion and exit
const cliArgs = process.argv.slice(2);
if (cliArgs.length >= 2 && !cliArgs[0].startsWith('-')) {
  const inputPath = cliArgs[0];
  const outputPath = cliArgs[1];
  Promise.resolve()
    .then(() => convertMarkdownWithMermaidToPdf(inputPath, outputPath))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}


