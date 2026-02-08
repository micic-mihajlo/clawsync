import { useState, useEffect } from 'react';
import './SyncBoardAutomations.css';
import { SyncBoardLayout } from '../components/syncboard/SyncBoardLayout';
import {
  Lightning,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  ArrowsClockwise,
  GitBranch,
  Globe,
  Envelope,
  Eye,
  Timer,
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

// n8n API — proxied through vite dev server to avoid CORS
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

export function SyncBoardAutomations() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);

  const fetchData = async () => {
    const [wfData, execData] = await Promise.all([
      n8nFetch('/workflows'),
      n8nFetch('/executions?limit=20'),
    ]);

    if (wfData) {
      setConnected(true);
      setWorkflows((wfData.data ?? []).map((w: any) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        nodeCount: w.nodes?.length ?? 0,
      })));
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

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleViewWorkflow = async (id: string) => {
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

  const getWorkflowIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('github') || lower.includes('git') || lower.includes('code')) return <GitBranch size={20} weight="regular" />;
    if (lower.includes('webhook')) return <Globe size={20} weight="regular" />;
    if (lower.includes('email') || lower.includes('mail')) return <Envelope size={20} weight="regular" />;
    if (lower.includes('monitor') || lower.includes('health') || lower.includes('uptime')) return <Eye size={20} weight="regular" />;
    if (lower.includes('morning') || lower.includes('schedule') || lower.includes('cron')) return <Timer size={20} weight="regular" />;
    return <Lightning size={20} weight="regular" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="auto-badge auto-badge-success"><CheckCircle size={12} /> Success</span>;
      case 'error':
      case 'crashed':
        return <span className="auto-badge auto-badge-error"><XCircle size={12} /> Failed</span>;
      case 'running':
        return <span className="auto-badge auto-badge-running"><ArrowsClockwise size={12} /> Running</span>;
      case 'waiting':
        return <span className="auto-badge auto-badge-waiting"><Clock size={12} /> Waiting</span>;
      default:
        return <span className="auto-badge">{status}</span>;
    }
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
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const activeCount = workflows.filter(w => w.active).length;
  const successCount = executions.filter(e => e.status === 'success').length;
  const failCount = executions.filter(e => e.status === 'error' || e.status === 'crashed').length;

  return (
    <SyncBoardLayout title="Automations (n8n)">
      <div className="automations-page">
        {/* Stats Bar */}
        <div className="auto-stats">
          <div className="auto-stat">
            <span className="auto-stat-value">{workflows.length}</span>
            <span className="auto-stat-label">Workflows</span>
          </div>
          <div className="auto-stat">
            <span className="auto-stat-value auto-stat-active">{activeCount}</span>
            <span className="auto-stat-label">Active</span>
          </div>
          <div className="auto-stat">
            <span className="auto-stat-value auto-stat-success">{successCount}</span>
            <span className="auto-stat-label">Successful</span>
          </div>
          <div className="auto-stat">
            <span className="auto-stat-value auto-stat-error">{failCount}</span>
            <span className="auto-stat-label">Failed</span>
          </div>
          <button 
            className="btn btn-ghost btn-sm auto-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <ArrowsClockwise size={16} className={refreshing ? 'spinning' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="auto-loading">Connecting to n8n...</div>
        ) : !connected ? (
          <div className="auto-empty">
            <Lightning size={32} weight="regular" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <p>Could not connect to n8n instance.</p>
            <p style={{ fontSize: '0.75rem' }}>Set <code>VITE_N8N_API_URL</code> and <code>VITE_N8N_API_KEY</code> in your environment.</p>
          </div>
        ) : (
          <div className="auto-content">
            {/* Workflows */}
            <section className="auto-section">
              <h3 className="auto-section-title">Workflows</h3>
              <div className="auto-workflow-grid">
                {workflows.map(wf => (
                  <div key={wf.id} className={`auto-workflow-card ${wf.active ? 'active' : 'inactive'}`}>
                    <div className="auto-wf-header">
                      <div className="auto-wf-icon">{getWorkflowIcon(wf.name)}</div>
                      <div className="auto-wf-info">
                        <h4 className="auto-wf-name">{wf.name}</h4>
                        <span className="auto-wf-meta">{wf.nodeCount} nodes · Updated {formatTime(wf.updatedAt)}</span>
                      </div>
                      <div className="auto-wf-status">
                        {wf.active ? (
                          <span className="auto-badge auto-badge-success"><Play size={12} /> Active</span>
                        ) : (
                          <span className="auto-badge auto-badge-inactive"><Pause size={12} /> Inactive</span>
                        )}
                      </div>
                    </div>
                    <button 
                      className="btn btn-ghost btn-sm auto-view-btn"
                      onClick={() => handleViewWorkflow(wf.id)}
                    >
                      View Pipeline →
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Workflow Detail — Pipeline View */}
            {selectedWorkflow && (
              <section className="auto-section">
                <h3 className="auto-section-title">
                  {selectedWorkflow.name} — Pipeline
                </h3>
                <div className="auto-pipeline">
                  {selectedWorkflow.nodes.map((node, i) => (
                    <div key={i} className="auto-pipeline-node">
                      <div className="auto-node-dot" />
                      <div className="auto-node-info">
                        <span className="auto-node-name">{node.name}</span>
                        <span className="auto-node-type">{node.type}</span>
                      </div>
                      {i < selectedWorkflow.nodes.length - 1 && (
                        <div className="auto-node-arrow">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Executions */}
            <section className="auto-section">
              <h3 className="auto-section-title">Recent Executions</h3>
              {executions.length > 0 ? (
                <table className="auto-exec-table">
                  <thead>
                    <tr>
                      <th>Workflow</th>
                      <th>Status</th>
                      <th>Started</th>
                      <th>Duration</th>
                      <th>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map(exec => (
                      <tr key={exec.id}>
                        <td className="auto-exec-name">{exec.workflowName}</td>
                        <td>{getStatusBadge(exec.status)}</td>
                        <td className="auto-exec-time">{formatTime(exec.startedAt)}</td>
                        <td className="auto-exec-duration">{getDuration(exec.startedAt, exec.stoppedAt)}</td>
                        <td><span className="auto-badge">{exec.mode}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="auto-empty">No recent executions yet.</div>
              )}
            </section>
          </div>
        )}
      </div>
    </SyncBoardLayout>
  );
}
