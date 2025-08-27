#!/usr/bin/env node
/*
 * MCP server exposing a tool to convert Markdown (with Mermaid code blocks)
 * to PDF using the existing conversion logic.
 *
 * This server communicates over stdio, suitable for MCP clients to run via npx.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

import { convertMarkdownWithMermaidToPdf } from './md_mermaid_to_pdf.js';

async function start() {
  // Signal converter to be silent on stdout when running under MCP
  process.env.MCP_SILENT = process.env.MCP_SILENT || '1';
  const server = new McpServer({ name: 'md-mermaid-to-pdf', version: '1.0.0' });

  await server.tool(
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
  
  // Keep server alive for MCP communication
  // Listen for close events to gracefully shutdown
  process.stdin.on('end', () => {
    process.exit(0);
  });
  
  process.stdin.on('close', () => {
    process.exit(0);
  });
  
  // Keep alive but allow graceful shutdown
  await new Promise((resolve) => {
    process.on('SIGTERM', resolve);
    process.on('SIGINT', resolve);
    // For npm/npx compatibility, also listen for stdin close
    process.stdin.resume();
  });
}

// CLI mode: if two positional args are provided, run conversion and exit
const cliArgs = process.argv.slice(2).filter(Boolean);

// Debug: log arguments for troubleshooting
if (!process.env.MCP_SILENT) {
  console.error(`DEBUG: process.argv = ${JSON.stringify(process.argv)}`);
  console.error(`DEBUG: cliArgs = ${JSON.stringify(cliArgs)}`);
  console.error(`DEBUG: cliArgs.length = ${cliArgs.length}`);
}

if (cliArgs.length >= 2) {
  const inputPath = cliArgs[0];
  const outputPath = cliArgs[1];
  if (!process.env.MCP_SILENT) {
    console.error(`DEBUG: Running CLI mode: ${inputPath} -> ${outputPath}`);
  }
  Promise.resolve()
    .then(() => convertMarkdownWithMermaidToPdf(inputPath, outputPath))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  if (!process.env.MCP_SILENT) {
    console.error(`DEBUG: Starting MCP server mode`);
  }
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}


