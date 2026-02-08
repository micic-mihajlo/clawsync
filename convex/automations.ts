'use node';

import { action, internalAction } from './_generated/server';
import { v } from 'convex/values';

/**
 * n8n Automations Integration
 * 
 * Fetches workflow data from the self-hosted n8n instance
 * and exposes it to the SyncBoard UI.
 */

// List all n8n workflows
export const listWorkflows = action({
  args: {},
  handler: async (_ctx): Promise<any[]> => {
    const apiUrl: string = process.env.N8N_API_URL ?? 'http://localhost:5678';
    const apiKey: string | undefined = process.env.N8N_API_KEY;
    
    if (!apiKey) {
      return [];
    }

    try {
      const response: Response = await fetch(`${apiUrl}/api/v1/workflows`, {
        headers: { 'X-N8N-API-KEY': apiKey },
      });

      if (!response.ok) {
        console.error('n8n API error:', response.status);
        return [];
      }

      const data: any = await response.json();
      return (data.data ?? []).map((w: any) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        nodeCount: w.nodes?.length ?? 0,
        tags: w.tags?.map((t: any) => t.name) ?? [],
      }));
    } catch (error) {
      console.error('Failed to fetch n8n workflows:', error);
      return [];
    }
  },
});

// Get recent executions for a workflow
export const getExecutions = action({
  args: {
    workflowId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<any[]> => {
    const apiUrl: string = process.env.N8N_API_URL ?? 'http://localhost:5678';
    const apiKey: string | undefined = process.env.N8N_API_KEY;
    
    if (!apiKey) {
      return [];
    }

    try {
      let url = `${apiUrl}/api/v1/executions?limit=${args.limit ?? 20}`;
      if (args.workflowId) {
        url += `&workflowId=${args.workflowId}`;
      }

      const response: Response = await fetch(url, {
        headers: { 'X-N8N-API-KEY': apiKey },
      });

      if (!response.ok) {
        console.error('n8n executions API error:', response.status);
        return [];
      }

      const data: any = await response.json();
      return (data.data ?? []).map((e: any) => ({
        id: e.id,
        workflowId: e.workflowId,
        workflowName: e.workflowData?.name ?? 'Unknown',
        status: e.status,
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt,
        mode: e.mode,
      }));
    } catch (error) {
      console.error('Failed to fetch n8n executions:', error);
      return [];
    }
  },
});

// Get workflow details
export const getWorkflow = action({
  args: { workflowId: v.string() },
  handler: async (_ctx, args): Promise<any> => {
    const apiUrl: string = process.env.N8N_API_URL ?? 'http://localhost:5678';
    const apiKey: string | undefined = process.env.N8N_API_KEY;
    
    if (!apiKey) {
      return null;
    }

    try {
      const response: Response = await fetch(`${apiUrl}/api/v1/workflows/${args.workflowId}`, {
        headers: { 'X-N8N-API-KEY': apiKey },
      });

      if (!response.ok) return null;

      const w: any = await response.json();
      return {
        id: w.id,
        name: w.name,
        active: w.active,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        nodes: (w.nodes ?? []).map((n: any) => ({
          name: n.name,
          type: n.type?.replace('n8n-nodes-base.', ''),
          position: n.position,
        })),
        connections: Object.keys(w.connections ?? {}),
      };
    } catch (error) {
      console.error('Failed to fetch workflow:', error);
      return null;
    }
  },
});
