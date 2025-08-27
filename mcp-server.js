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
  const server = new McpServer({ name: 'md-mermaid-to-pdf', version: '1.0.0' });

  server.tool(
    'convert_markdown_to_pdf',
    'Convert a Markdown file (with ```mermaid code blocks) to a PDF.',
    {
      inputPath: z.string().describe('Absolute path to input .md file'),
      outputPath: z.string().describe('Absolute path to output .pdf file'),
    },
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

start().catch((err) => {
  console.error(err);
  process.exit(1);
});


