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
}

// CLI mode: if two positional args are provided, run conversion and exit
const cliArgs = process.argv.slice(2).filter(Boolean);

// Debug: log arguments for troubleshooting
if (!process.env.MCP_SILENT) {
  console.error(`DEBUG: process.argv = ${JSON.stringify(process.argv)}`);
  console.error(`DEBUG: cliArgs = ${JSON.stringify(cliArgs)}`);
}

// Check if this is a CLI invocation or MCP server mode
// The server is the default. A 'convert' command is needed for CLI mode.
const isCLI = cliArgs.length > 0 && cliArgs[0] === 'convert';

if (isCLI) {
  if (cliArgs.length < 3) {
    console.error('Usage: node mcp-server.js convert <inputPath> <outputPath>');
    process.exit(1);
  }
  const inputPath = cliArgs[1];
  const outputPath = cliArgs[2];
  if (!process.env.MCP_SILENT) {
    console.error(`DEBUG: Running CLI mode: ${inputPath} -> ${outputPath}`);
  }
  Promise.resolve()
    .then(() => convertMarkdownWithMermaidToPdf(inputPath, outputPath))
    .then(() => {
      if (!process.env.MCP_SILENT) {
        console.error('DEBUG: CLI conversion completed successfully');
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('CLI conversion error:', err);
      process.exit(1);
    });
} else {
  if (!process.env.MCP_SILENT) {
    console.error(`DEBUG: Starting MCP server mode`);
  }
  start().catch((err) => {
    console.error('MCP server error:', err);
    process.exit(1);
  });
}


