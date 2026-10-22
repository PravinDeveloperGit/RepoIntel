import { useQuery, useMutation } from '@tanstack/react-query';
import { repoAPI, evalAPI } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { BarChart3, Play, Trophy } from 'lucide-react';
import { useState } from 'react';

const SYSTEMS = [
  { value: 'A', label: 'System A — BM25 Baseline' },
  { value: 'B', label: 'System B — Vector Baseline' },
  { value: 'C', label: 'System C — Hybrid RRF' },
  { value: 'D', label: 'System D — Hybrid + Rerank' },
  { value: 'E', label: 'System E — Full Pipeline' },
];

interface EvalRun {
  _id: string;
  systemVariant: string;
  status: string;
  metrics?: Record<string, number>;
  createdAt: string;
}

export default function EvaluationPage() {
  const [system, setSystem] = useState('E');
  const [repoId, setRepoId] = useState('');

  const { data: reposData } = useQuery({ queryKey: ['repositories'], queryFn: () => repoAPI.list() });
  const { data: runsData, refetch } = useQuery({ queryKey: ['eval-runs'], queryFn: () => evalAPI.runs() });
  const { data: compareData } = useQuery({ queryKey: ['eval-compare'], queryFn: () => evalAPI.compare() });

  const repos = reposData?.data?.repositories ?? [];
  const runs: EvalRun[] = runsData?.data?.runs ?? [];
  const comparison = compareData?.data?.comparison ?? [];

  const runMutation = useMutation({
    mutationFn: () => evalAPI.createRun({ systemVariant: system, repositoryId: repoId || undefined }),
    onSuccess: () => { toast.success('Evaluation run started!'); refetch(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to start run'),
  });

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Evaluation</h1>
          <p className="text-surface-400 mt-1">Compare retrieval system variants with standard IR metrics</p>
        </div>

        {/* Run configuration */}
        <div className="glass rounded-2xl p-6 mb-8">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Play className="w-4 h-4 text-brand-400" /> Run Evaluation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">System Variant</label>
              <select
                id="eval-system-select"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              >
                {SYSTEMS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Repository (optional)</label>
              <select
                id="eval-repo-select"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              >
                <option value="">All repositories</option>
                {repos.map((r: any) => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button
                id="eval-run-btn"
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-sm font-medium transition-all duration-200 glow-brand"
              >
                {runMutation.isPending ? <LoadingSpinner size="sm" /> : <><Play className="w-4 h-4" /> Run</>}
              </button>
            </div>
          </div>
        </div>

        {/* Comparison table */}
        {comparison.length > 0 && (
          <div className="glass rounded-2xl p-6 mb-8">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent-amber" /> System Comparison
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-surface-400 border-b border-surface-700">
                    <th className="text-left py-2 pr-4">System</th>
                    <th className="text-right py-2 pr-4">Success@5</th>
                    <th className="text-right py-2 pr-4">MRR</th>
                    <th className="text-right py-2 pr-4">P@3</th>
                    <th className="text-right py-2">Latency (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row: any) => (
                    <tr key={row.system} className="border-b border-surface-800 hover:bg-surface-800/30 transition-colors">
                      <td className="py-3 pr-4 font-medium text-white">{row.system}</td>
                      <td className="text-right py-3 pr-4 text-accent-emerald">{row.successAt5?.toFixed(3) ?? '—'}</td>
                      <td className="text-right py-3 pr-4 text-brand-400">{row.mrr?.toFixed(3) ?? '—'}</td>
                      <td className="text-right py-3 pr-4 text-accent-cyan">{row.precisionAt3?.toFixed(3) ?? '—'}</td>
                      <td className="text-right py-3 text-surface-400">{row.latencyMs ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent runs */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-400" /> Recent Runs
          </h2>
          {runs.length === 0 ? (
            <p className="text-surface-400 text-sm">No evaluation runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 10).map((run) => (
                <div key={run._id} className="flex items-center gap-4 p-3 rounded-xl bg-surface-800/40">
                  <span className="w-8 h-8 rounded-lg bg-brand-600/20 text-brand-300 flex items-center justify-center text-sm font-bold">{run.systemVariant}</span>
                  <div className="flex-1">
                    <p className="text-sm text-white">System {run.systemVariant}</p>
                    <p className="text-xs text-surface-400">{new Date(run.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    run.status === 'completed' ? 'bg-accent-emerald/20 text-accent-emerald' :
                    run.status === 'running' ? 'bg-accent-amber/20 text-accent-amber' :
                    'bg-surface-700 text-surface-400'
                  }`}>
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
