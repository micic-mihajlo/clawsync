import { Agent } from '@convex-dev/agent';
import { components } from '../_generated/api';
import { anthropic } from '@ai-sdk/anthropic';

/**
 * ClawSync Agent Definition
 *
 * The agent is configured minimally here. Soul document, model config,
 * and tools are all loaded from Convex at runtime. This means SyncBoard
 * changes take effect on the next message without redeploying.
 *
 * Model selection and tools are resolved dynamically via:
 * - modelRouter.ts: Resolves provider + model from agentConfig
 * - toolLoader.ts: Assembles tools from skillRegistry + MCP servers
 */
export const clawsyncAgent = new Agent(components.agent, {
  name: 'ClawSync Agent',
  languageModel: anthropic('claude-sonnet-4-20250514'),
  instructions: 'You are a helpful AI assistant.',
  // Tools are loaded dynamically - see toolLoader.ts
  tools: {},
});

// Export the agent for use in actions
export default clawsyncAgent;
