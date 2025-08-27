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
    '마크다운 파일(.md)을 PDF(.pdf)로 변환합니다. 마크다운 내부에 Mermaid 다이어그램이 포함되어 있어도 렌더링됩니다.',
    {
      inputPath: z.string().describe(
        'PDF로 변환할 원본 마크다운(.md) 파일의 전체 절대 경로. 예시: /Users/test/report.md'
      ),
      outputPath: z.string().describe(
        '생성될 PDF 파일이 저장될 전체 절대 경로. 생략 시 원본 파일명에 .pdf 확장자를 붙여 같은 폴더에 저장됩니다.'
      ).optional(), // outputPath를 선택사항으로 변경
    },
    async ({ inputPath, outputPath }) => {
      if (!path.isAbsolute(inputPath)) {
        throw new Error('inputPath는 반드시 절대 경로여야 합니다.');
      }
      if (outputPath && !path.isAbsolute(outputPath)) {
        throw new Error('outputPath가 제공될 경우, 반드시 절대 경로여야 합니다.');
      }
      if (!fs.existsSync(inputPath)) {
        throw new Error(`입력 파일을 찾을 수 없습니다: ${inputPath}`);
      }

      // outputPath가 없으면 기본값 생성
      const finalOutputPath = outputPath || inputPath.replace(/\.md$/, '.pdf');

      const produced = convertMarkdownWithMermaidToPdf(inputPath, finalOutputPath);
      return {
        content: [{ type: 'text', text: `PDF 생성 완료: ${produced}` }],
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


