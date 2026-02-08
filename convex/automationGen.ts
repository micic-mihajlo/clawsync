'use node';

import { action } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { clawsyncAgent } from './agent/clawsync';

const WORKFLOW_SYSTEM_PROMPT = `You are an expert n8n workflow architect. Given a description of an automation, generate a complete n8n workflow JSON.

RULES:
- Output ONLY valid JSON — no markdown, no explanation, no code fences
- Use real n8n node types (e.g. "n8n-nodes-base.webhook", "n8n-nodes-base.httpRequest", "n8n-nodes-base.code", "n8n-nodes-base.discord", "n8n-nodes-base.slack", "n8n-nodes-base.gmail", "n8n-nodes-base.if", "n8n-nodes-base.set", "n8n-nodes-base.scheduleTrigger")
- For triggers: "n8n-nodes-base.webhook", "n8n-nodes-base.scheduleTrigger", "n8n-nodes-base.emailReadImap"
- Include proper connections between nodes
- Position nodes left-to-right with ~200px horizontal spacing
- Every workflow needs at least one trigger node
- Include a "settings" object with "executionOrder": "v1"
- Format: { "name": "...", "nodes": [...], "connections": {...}, "settings": { "executionOrder": "v1" } }

NODE FORMAT:
{
  "parameters": { ... },
  "name": "Node Name",
  "type": "n8n-nodes-base.nodeType",
  "typeVersion": 1,
  "position": [x, y]
}

CONNECTIONS FORMAT:
{
  "Source Node Name": {
    "main": [[{ "node": "Target Node Name", "type": "main", "index": 0 }]]
  }
}

Common patterns:
- Webhook → Process → Notify: Great for integrations
- Schedule → Fetch → Transform → Store: Great for data sync
- Trigger → AI/Code → Decide → Act: Great for smart automation`;

/**
 * Generate an n8n workflow from a natural language description.
 * Returns the workflow JSON for client-side deployment.
 */
export const generateWorkflow = action({
  args: {
    description: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { thread } = await clawsyncAgent.createThread(ctx, {});

      const result = await thread.generateText({
        prompt: `${WORKFLOW_SYSTEM_PROMPT}\n\nGenerate an n8n workflow for: ${args.description}`,
      });

      // Extract JSON from the response
      let workflowJson;
      const text = result.text.trim();
      
      try {
        workflowJson = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          workflowJson = JSON.parse(jsonMatch[1].trim());
        } else {
          const start = text.indexOf('{');
          const end = text.lastIndexOf('}');
          if (start !== -1 && end !== -1) {
            workflowJson = JSON.parse(text.slice(start, end + 1));
          } else {
            throw new Error('Could not parse workflow JSON');
          }
        }
      }

      if (!workflowJson.name || !workflowJson.nodes) {
        throw new Error('Invalid workflow — missing name or nodes');
      }

      // Log activity
      await ctx.runMutation(internal.activityLog.log, {
        actionType: 'workflow_generated',
        summary: `Generated workflow: "${workflowJson.name}" (${workflowJson.nodes.length} nodes)`,
        visibility: 'public',
      });

      return {
        success: true,
        workflow: workflowJson,
      };
    } catch (error: any) {
      console.error('Workflow generation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate workflow',
      };
    }
  },
});
