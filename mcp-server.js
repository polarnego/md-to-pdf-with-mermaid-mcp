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
  // Different behavior for direct execution vs npx
  if (process.env.npm_config_user_config || process.env.npm_execpath) {
    // Running under npm/npx - use timeout-based approach
    console.error("Running under npm/npx environment");
    let lastActivity = Date.now();
    
    // Update activity on stdin data
    process.stdin.on('data', () => {
      lastActivity = Date.now();
    });
    
    // Check for inactivity every 5 seconds
    const inactivityCheck = setInterval(() => {
      if (Date.now() - lastActivity > 30000) { // 30 seconds of inactivity
        console.error("Shutting down due to inactivity");
        process.exit(0);
      }
    }, 5000);
    
    // Cleanup on exit
    process.on('SIGTERM', () => {
      clearInterval(inactivityCheck);
      process.exit(0);
    });
    process.on('SIGINT', () => {
      clearInterval(inactivityCheck);
      process.exit(0);
    });
    
    process.stdin.resume();
  } else {
    // Direct execution - use original approach
    console.error("Running in direct execution mode");
    process.stdin.on('end', () => {
      process.exit(0);
    });
    
    process.stdin.on('close', () => {
      process.exit(0);
    });
    
    await new Promise((resolve) => {
      process.on('SIGTERM', resolve);
      process.on('SIGINT', resolve);
      process.stdin.resume();
    });
  }
}

// CLI mode: if two positional args are provided, run conversion and exit
const cliArgs = process.argv.slice(2).filter(Boolean);

// Debug: log arguments for troubleshooting
if (!process.env.MCP_SILENT) {
  console.error(`DEBUG: process.argv = ${JSON.stringify(process.argv)}`);
  console.error(`DEBUG: cliArgs = ${JSON.stringify(cliArgs)}`);
  console.error(`DEBUG: cliArgs.length = ${cliArgs.length}`);
  console.error(`DEBUG: process.stdin.isTTY = ${process.stdin.isTTY}`);
  console.error(`DEBUG: npm environment = ${!!(process.env.npm_config_user_config || process.env.npm_execpath)}`);
}

// Check if this is a CLI invocation or MCP server mode
const isCLI = cliArgs.length >= 2;
const isNpmExecution = !!(process.env.npm_config_user_config || process.env.npm_execpath);
const hasStdinTTY = process.stdin.isTTY;

if (!process.env.MCP_SILENT) {
  console.error(`DEBUG: isCLI=${isCLI}, isNpmExecution=${isNpmExecution}, hasStdinTTY=${hasStdinTTY}`);
}

if (isCLI) {
  const inputPath = cliArgs[0];
  const outputPath = cliArgs[1];
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


