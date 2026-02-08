import { useState, useEffect } from 'react';
import './SyncBoardAutomations.css';
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
} from '@phosphor-icons/react';

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
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

const N8N_API_KEY = import.meta.env.VITE_N8N_API_KEY || '';

async function n8nFetch(path: string): Promise<any> {
  if (!N8N_API_KEY) return null;
  try {
    const res = await fetch(`/n8n-api${path}`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const NODE_COLORS: Record<string, string> = {
  'webhook': '#ea5b26',
  'httpRequest': '#3b82f6',
  'filter': '#f59e0b',
  'set': '#8b5cf6',
  'if': '#f59e0b',
  'code': '#10b981',
  'function': '#10b981',
  'schedule': '#6366f1',
  'cron': '#6366f1',
  'discord': '#5865F2',
  'slack': '#4A154B',
  'telegram': '#229ED9',
  'gmail': '#EA4335',
  'httpRequest': '#3b82f6',
};

function getNodeColor(type: string): string {
  const lower = type.toLowerCase();
  for (const [key, color] of Object.entries(NODE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#6a6a6a';
}

export function SyncBoardAutomations() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showExecs, setShowExecs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
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
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        nodeCount: w.nodes?.length ?? 0,
      }));
      setWorkflows(wfs);
      // Auto-select first active workflow
      if (!selectedId && wfs.length > 0) {
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

  useEffect(() => { fetchData(); }, []);

  const getWfIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('github') || lower.includes('git') || lower.includes('code')) return <GitBranch size={16} weight="bold" />;
    if (lower.includes('webhook')) return <Globe size={16} weight="bold" />;
    if (lower.includes('email') || lower.includes('mail')) return <Envelope size={16} weight="bold" />;
    if (lower.includes('monitor') || lower.includes('health') || lower.includes('uptime')) return <Eye size={16} weight="bold" />;
    if (lower.includes('morning') || lower.includes('schedule')) return <Timer size={16} weight="bold" />;
    return <Lightning size={16} weight="bold" />;
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  const getDuration = (start: string, end: string | null) => {
    if (!start || !end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m`;
  };

  const activeCount = workflows.filter(w => w.active).length;

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

  if (!connected) {
    return (
      <SyncBoardLayout title="Automations">
        <div className="auto-disconnected">
          <Lightning size={40} weight="duotone" />
          <h3>n8n not connected</h3>
          <p>Set <code>VITE_N8N_API_URL</code> and <code>VITE_N8N_API_KEY</code> to connect your automation engine.</p>
        </div>
      </SyncBoardLayout>
    );
  }

  return (
    <SyncBoardLayout title="Automations">
      <div className="auto-page">
        {/* Header with pixel font */}
        <div className="auto-header">
          <div className="auto-header-left">
            <h2 className="auto-title">
              <span className="auto-title-pixel">{workflows.length}</span> workflows
              <span className="auto-title-dot">·</span>
              <span className="auto-title-pixel auto-title-active">{activeCount}</span> active
            </h2>
          </div>
          <button
            className="auto-refresh-btn"
            onClick={() => { setRefreshing(true); fetchData(); }}
            disabled={refreshing}
          >
            <ArrowsClockwise size={14} className={refreshing ? 'spinning' : ''} />
          </button>
        </div>

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
        {selectedWorkflow && (
          <div className="auto-pipeline-hero">
            <div className="auto-pipeline-label">
              <span className="auto-pipeline-name">{selectedWorkflow.name}</span>
              <span className={`auto-pipeline-status ${selectedWorkflow.active ? 'active' : ''}`}>
                {selectedWorkflow.active ? '● live' : '○ paused'}
              </span>
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
