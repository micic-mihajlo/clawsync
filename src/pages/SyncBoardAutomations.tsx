import { useState, useEffect, useRef } from 'react';
import './SyncBoardAutomations.css';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import {
  Lightning,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  GitBranch,
  Globe,
  Envelope,
  Eye,
  Timer,
  CaretDown,
  CaretUp,
  Plus,
  Robot,
  Rocket,
  SpinnerGap,
  X,
} from '@phosphor-icons/react';

/* ─── Types ─── */
interface Workflow {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string;
  nodeCount: number;
}

interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  startedAt: string;
  stoppedAt: string | null;
  mode: string;
}

interface WorkflowNode {
  name: string;
  type: string;
}

interface WorkflowDetail {
  id: string;
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
}

/* ─── n8n API ─── */
const N8N_API_KEY = import.meta.env.VITE_N8N_API_KEY || '';

async function n8nFetch(path: string, opts?: RequestInit): Promise<any> {
  if (!N8N_API_KEY) return null;
  try {
    const res = await fetch(`/n8n-api${path}`, {
      ...opts,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        ...opts?.headers,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ─── Node Colors ─── */
const NODE_COLORS: Record<string, string> = {
  'webhook': '#ea5b26',
  'httpRequest': '#3b82f6',
  'http': '#3b82f6',
  'filter': '#f59e0b',
  'set': '#8b5cf6',
  'if': '#f59e0b',
  'switch': '#f59e0b',
  'code': '#10b981',
  'function': '#10b981',
  'schedule': '#6366f1',
  'cron': '#6366f1',
  'discord': '#5865F2',
  'slack': '#4A154B',
  'telegram': '#229ED9',
  'gmail': '#EA4335',
  'email': '#EA4335',
  'noOp': '#9ca3af',
  'merge': '#8b5cf6',
};

function getNodeColor(type: string): string {
  const lower = type.toLowerCase();
  for (const [key, color] of Object.entries(NODE_COLORS)) {
    if (lower.includes(key.toLowerCase())) return color;
  }
  return '#6a6a6a';
}

function getWfIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('github') || lower.includes('git') || lower.includes('code')) return <GitBranch size={16} weight="bold" />;
  if (lower.includes('webhook')) return <Globe size={16} weight="bold" />;
  if (lower.includes('email') || lower.includes('mail')) return <Envelope size={16} weight="bold" />;
  if (lower.includes('monitor') || lower.includes('health') || lower.includes('uptime')) return <Eye size={16} weight="bold" />;
  if (lower.includes('morning') || lower.includes('schedule')) return <Timer size={16} weight="bold" />;
  return <Lightning size={16} weight="bold" />;
}

/* ─── Helpers ─── */
function formatTime(dateStr: string) {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getDuration(start: string, end: string | null) {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m`;
}

/* ─── Suggested prompts ─── */
const SUGGESTIONS = [
  'Monitor a website and alert on Discord when it goes down',
  'Daily email digest of GitHub issues',
  'Webhook that formats incoming data and stores it',
  'Slack bot that responds to messages with AI',
];

/* ─── Component ─── */
export function SyncBoardAutomations() {
  const generateWorkflow = useAction(api.automationGen.generateWorkflow);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showExecs, setShowExecs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);
  const [deploying, setDeploying] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchData = async (autoSelect = true) => {
    const [wfData, execData] = await Promise.all([
      n8nFetch('/workflows'),
      n8nFetch('/executions?limit=15'),
    ]);

    if (wfData) {
      setConnected(true);
      const wfs = (wfData.data ?? []).map((w: any) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        updatedAt: w.updatedAt,
        nodeCount: w.nodes?.length ?? 0,
      }));
      setWorkflows(wfs);
      if (autoSelect && !selectedId && wfs.length > 0) {
        const first = wfs.find((w: Workflow) => w.active) ?? wfs[0];
        handleSelectWorkflow(first.id);
      }
    }

    if (execData) {
      setExecutions((execData.data ?? []).map((e: any) => ({
        id: e.id,
        workflowId: e.workflowId,
        workflowName: e.workflowData?.name ?? 'Unknown',
        status: e.status,
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt,
        mode: e.mode,
      })));
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleSelectWorkflow = async (id: string) => {
    setSelectedId(id);
    setGenResult(null);
    setShowGenerator(false);
    const data = await n8nFetch(`/workflows/${id}`);
    if (data) {
      setSelectedWorkflow({
        id: data.id,
        name: data.name,
        active: data.active,
        nodes: (data.nodes ?? []).map((n: any) => ({
          name: n.name,
          type: (n.type ?? '').replace('n8n-nodes-base.', ''),
        })),
      });
    }
  };

  const handleGenerate = async () => {
    if (!genPrompt.trim()) return;
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    setSelectedWorkflow(null);
    setSelectedId(null);

    try {
      const result = await generateWorkflow({
        description: genPrompt.trim(),
        sessionId: 'syncboard-automations',
      });

      if (result.success && result.workflow) {
        setGenResult(result.workflow);
        // Show the generated workflow in the pipeline view
        setSelectedWorkflow({
          id: 'generated',
          name: result.workflow.name,
          active: false,
          nodes: (result.workflow.nodes ?? []).map((n: any) => ({
            name: n.name,
            type: (n.type ?? '').replace('n8n-nodes-base.', ''),
          })),
        });
      } else {
        setGenError(result.error || 'Generation failed');
      }
    } catch (err: any) {
      setGenError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeploy = async () => {
    if (!genResult) return;
    setDeploying(true);
    try {
      const res = await n8nFetch('/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genResult),
      });

      if (res?.id) {
        setGenResult(null);
        setShowGenerator(false);
        setGenPrompt('');
        await fetchData(false);
        handleSelectWorkflow(res.id);
      } else {
        setGenError('Failed to deploy — check n8n logs');
      }
    } catch (err: any) {
      setGenError(err.message || 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (showGenerator && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showGenerator]);

  const activeCount = workflows.filter(w => w.active).length;

  /* ─── Loading ─── */
  if (loading) {
    return (
      <SyncBoardLayout title="Automations">
        <div className="auto-loading-screen">
          <div className="auto-loading-pulse" />
          <span className="auto-loading-text">connecting to n8n...</span>
        </div>
      </SyncBoardLayout>
    );
  }

  /* ─── Disconnected ─── */
  if (!connected) {
    return (
      <SyncBoardLayout title="Automations">
        <div className="auto-disconnected">
          <Lightning size={40} weight="duotone" />
          <h3>n8n not connected</h3>
          <p>Set <code>VITE_N8N_API_URL</code> and <code>VITE_N8N_API_KEY</code></p>
        </div>
      </SyncBoardLayout>
    );
  }

  /* ─── Main View ─── */
  return (
    <SyncBoardLayout title="Automations">
      <div className="auto-page">
        {/* Header */}
        <div className="auto-header">
          <h2 className="auto-title">
            <span className="auto-title-pixel">{workflows.length}</span> workflows
            <span className="auto-title-dot">·</span>
            <span className="auto-title-pixel auto-title-active">{activeCount}</span> active
          </h2>
          <div className="auto-header-actions">
            <button
              className={`auto-gen-trigger ${showGenerator ? 'active' : ''}`}
              onClick={() => setShowGenerator(!showGenerator)}
            >
              {showGenerator ? <X size={14} /> : <Plus size={14} weight="bold" />}
              {showGenerator ? 'Close' : 'Generate'}
            </button>
            <button
              className="auto-refresh-btn"
              onClick={() => { setRefreshing(true); fetchData(); }}
              disabled={refreshing}
            >
              <ArrowsClockwise size={14} className={refreshing ? 'spinning' : ''} />
            </button>
          </div>
        </div>

        {/* Generator Panel */}
        {showGenerator && (
          <div className="auto-generator">
            <div className="auto-gen-header">
              <Robot size={18} weight="duotone" />
              <span>Describe your automation</span>
            </div>
            <div className="auto-gen-input-row">
              <input
                ref={inputRef}
                type="text"
                className="auto-gen-input"
                placeholder="e.g. Monitor RSS feeds and post summaries to Slack..."
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !generating && handleGenerate()}
                disabled={generating}
              />
              <button
                className="auto-gen-btn"
                onClick={handleGenerate}
                disabled={generating || !genPrompt.trim()}
              >
                {generating ? (
                  <SpinnerGap size={16} className="spinning" />
                ) : (
                  <Lightning size={16} weight="fill" />
                )}
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {!genPrompt && !generating && !genResult && (
              <div className="auto-gen-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="auto-gen-suggestion" onClick={() => setGenPrompt(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {genError && (
              <div className="auto-gen-error">
                <XCircle size={14} /> {genError}
              </div>
            )}
          </div>
        )}

        {/* Deploy bar — shown when we have a generated workflow */}
        {genResult && (
          <div className="auto-deploy-bar">
            <span className="auto-deploy-info">
              <CheckCircle size={16} weight="fill" />
              Generated: <strong>{genResult.name}</strong> ({genResult.nodes?.length ?? 0} nodes)
            </span>
            <button className="auto-deploy-btn" onClick={handleDeploy} disabled={deploying}>
              {deploying ? <SpinnerGap size={14} className="spinning" /> : <Rocket size={14} weight="fill" />}
              {deploying ? 'Deploying...' : 'Deploy to n8n'}
            </button>
          </div>
        )}

        {/* Workflow selector strip */}
        <div className="auto-wf-strip">
          {workflows.map(wf => (
            <button
              key={wf.id}
              className={`auto-wf-chip ${selectedId === wf.id ? 'selected' : ''} ${wf.active ? '' : 'inactive'}`}
              onClick={() => handleSelectWorkflow(wf.id)}
            >
              <span className="auto-wf-chip-icon">{getWfIcon(wf.name)}</span>
              <span className="auto-wf-chip-name">{wf.name}</span>
              {wf.active ? (
                <Play size={10} weight="fill" className="auto-wf-chip-status" />
              ) : (
                <Pause size={10} weight="fill" className="auto-wf-chip-status inactive" />
              )}
            </button>
          ))}
        </div>

        {/* Pipeline Hero */}
        {selectedWorkflow ? (
          <div className={`auto-pipeline-hero ${genResult ? 'generated' : ''}`}>
            <div className="auto-pipeline-label">
              <span className="auto-pipeline-name">{selectedWorkflow.name}</span>
              <span className={`auto-pipeline-status ${selectedWorkflow.active ? 'active' : ''}`}>
                {genResult ? '◆ preview' : selectedWorkflow.active ? '● live' : '○ paused'}
              </span>
              <span className="auto-pipeline-count">{selectedWorkflow.nodes.length} nodes</span>
            </div>
            <div className="auto-pipeline-flow">
              {selectedWorkflow.nodes.map((node, i) => (
                <div key={i} className="auto-pipe-step">
                  <div
                    className="auto-pipe-node"
                    style={{ '--node-color': getNodeColor(node.type) } as React.CSSProperties}
                  >
                    <div className="auto-pipe-node-ring" />
                    <div className="auto-pipe-node-body">
                      <span className="auto-pipe-node-name">{node.name}</span>
                      <span className="auto-pipe-node-type">{node.type}</span>
                    </div>
                  </div>
                  {i < selectedWorkflow.nodes.length - 1 && (
                    <div className="auto-pipe-connector">
                      <div className="auto-pipe-line" />
                      <div className="auto-pipe-arrow">▸</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : !generating ? (
          <div className="auto-pipeline-empty">
            <Lightning size={32} weight="duotone" />
            <p>Select a workflow above or generate a new one</p>
          </div>
        ) : null}

        {/* Generating skeleton */}
        {generating && !selectedWorkflow && (
          <div className="auto-pipeline-hero auto-pipeline-skeleton">
            <div className="auto-pipeline-label">
              <span className="auto-pipeline-name">Generating workflow...</span>
            </div>
            <div className="auto-pipeline-flow">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="auto-pipe-step">
                  <div className="auto-pipe-node skeleton">
                    <div className="auto-pipe-node-ring" />
                    <div className="auto-pipe-node-body">
                      <span className="auto-pipe-node-name skeleton-text">&nbsp;</span>
                      <span className="auto-pipe-node-type skeleton-text">&nbsp;</span>
                    </div>
                  </div>
                  {i < 4 && (
                    <div className="auto-pipe-connector">
                      <div className="auto-pipe-line" />
                      <div className="auto-pipe-arrow">▸</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Executions — collapsible */}
        <div className="auto-execs-section">
          <button className="auto-execs-toggle" onClick={() => setShowExecs(!showExecs)}>
            <span className="auto-execs-toggle-label">
              Recent Executions
              <span className="auto-execs-count">{executions.length}</span>
            </span>
            {showExecs ? <CaretUp size={14} /> : <CaretDown size={14} />}
          </button>

          {showExecs && (
            <div className="auto-execs-list">
              {executions.map(exec => (
                <div key={exec.id} className="auto-exec-row">
                  <span className="auto-exec-wf">{exec.workflowName}</span>
                  <span className={`auto-exec-status ${exec.status}`}>
                    {exec.status === 'success' ? <CheckCircle size={12} weight="fill" /> :
                     exec.status === 'error' || exec.status === 'crashed' ? <XCircle size={12} weight="fill" /> :
                     <ArrowsClockwise size={12} />}
                    {exec.status}
                  </span>
                  <span className="auto-exec-meta">{formatTime(exec.startedAt)}</span>
                  <span className="auto-exec-meta">{getDuration(exec.startedAt, exec.stoppedAt)}</span>
                </div>
              ))}
              {executions.length === 0 && (
                <div className="auto-exec-empty">No executions yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </SyncBoardLayout>
  );
}
