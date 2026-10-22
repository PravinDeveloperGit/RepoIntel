import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repoAPI } from '../../lib/api';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { FolderGit2, Plus, Trash2, Upload, ChevronRight } from 'lucide-react';

interface Repository {
  _id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
}

export default function RepositoriesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => repoAPI.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => repoAPI.create({ name: form.name, description: form.description }),
    onSuccess: () => {
      toast.success('Repository created!');
      setForm({ name: '', description: '' });
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create repository'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repoAPI.delete(id),
    onSuccess: () => {
      toast.success('Repository deleted');
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete repository'),
  });

  const repos: Repository[] = data?.data?.repositories ?? [];

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Repositories</h1>
            <p className="text-surface-400 mt-1">Manage your code repositories</p>
          </div>
          <button
            id="create-repo-btn"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 font-medium text-sm transition-all duration-200 glow-brand"
          >
            <Plus className="w-4 h-4" /> New Repository
          </button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 w-full max-w-md animate-fade-in">
              <h2 className="text-lg font-bold text-white mb-4">New Repository</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Name</label>
                  <input
                    id="repo-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="my-project"
                    className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Description (optional)</label>
                  <input
                    id="repo-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description…"
                    className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-xl border border-surface-600 text-surface-300 hover:text-white text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="repo-create-submit"
                    onClick={() => createMutation.mutate()}
                    disabled={!form.name || createMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-sm font-medium transition-all duration-200"
                  >
                    {createMutation.isPending ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Repository list */}
        {isLoading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" label="Loading repositories…" /></div>
        ) : repos.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <FolderGit2 className="w-12 h-12 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-400">No repositories yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {repos.map((repo) => (
              <div key={repo._id} className="glass rounded-xl p-5 glass-hover flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center flex-shrink-0">
                  <FolderGit2 className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{repo.name}</p>
                  {repo.description && <p className="text-sm text-surface-400 truncate">{repo.description}</p>}
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                    repo.status === 'ready' ? 'bg-accent-emerald/20 text-accent-emerald' :
                    repo.status === 'indexing' ? 'bg-accent-amber/20 text-accent-amber' :
                    'bg-surface-700 text-surface-400'
                  }`}>
                    {repo.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (confirm('Delete this repository?')) deleteMutation.mutate(repo._id);
                    }}
                    className="p-2 rounded-lg text-surface-400 hover:text-accent-rose hover:bg-accent-rose/10 transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    to={`/repositories/${repo._id}`}
                    className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-all duration-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
