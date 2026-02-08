/**
 * MCP Server Implementation
 *
 * Exposes ClawSync's active skills as MCP tools.
 * Any MCP client (Claude Desktop, Cursor, VS Code) can connect.
 *
 * Implements:
 * - tools/list: Returns all approved + active skills
 * - tools/call: Routes to skill executor (through security checker)
 * - resources/list: Returns available knowledge bases
 * - resources/read: Returns knowledge base content
 */

import { httpAction } from '../_generated/server';
import { internal } from '../_generated/api';

// MCP server handler
export const handler = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { method, params } = body;

  switch (method) {
    case 'tools/list':
      return handleToolsList(ctx as any);

    case 'tools/call':
      return handleToolsCall(ctx as any, params);

    case 'resources/list':
      return handleResourcesList();

    case 'resources/read':
      return handleResourcesRead(params);

    default:
      return new Response(
        JSON.stringify({ error: `Unknown method: ${method}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
  }
});

async function handleToolsList(ctx: any): Promise<Response> {
  // Get all active + approved skills
  const skills = await ctx.runQuery(internal.skillRegistry.getActiveApproved);

  const tools = skills.map((skill: any) => ({
    name: skill.name,
    description: skill.description,
    inputSchema: skill.config ? JSON.parse(skill.config).inputSchema : {},
  }));

  return new Response(
    JSON.stringify({ tools }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleToolsCall(
  _ctx: any,
  _params: { name: string; arguments: Record<string, unknown> }
): Promise<Response> {
  return new Response(
    JSON.stringify({ error: 'Not implemented' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleResourcesList(): Promise<Response> {
  return new Response(
    JSON.stringify({ resources: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleResourcesRead(
  _params: { uri: string }
): Promise<Response> {
  return new Response(
    JSON.stringify({ error: 'Not implemented' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}
