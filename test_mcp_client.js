#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

if (process.argv.length < 4) {
  console.error('Usage: node test_mcp_client.js <input.md> <output.pdf>');
  process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/Users/sykim-pro/work/mcp/md_to_pdf_with_mermaid/mcp-server.js'],
    env: { MCP_SILENT: '1' }
  });

  const client = new Client({
    name: 'local-mcp-client',
    version: '0.1.0'
  });

  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools:', JSON.stringify(tools, null, 2));

  const result = await client.callTool({
    name: 'convert_markdown_to_pdf',
    arguments: {
      inputPath,
      outputPath
    }
  });

  console.log('Tool result:', JSON.stringify(result, null, 2));
  await client.close();
}

main().catch((err) => {
  console.error('Test MCP client error:', err);
  process.exit(1);
});
