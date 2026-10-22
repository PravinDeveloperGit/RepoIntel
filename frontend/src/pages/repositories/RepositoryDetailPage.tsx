import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { repoAPI } from '../../lib/api';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { Upload, RefreshCw, FolderGit2, ArrowLeft, FileCode, BarChart3 } from 'lucide-react';
import { useRef } from 'react';

export default function RepositoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['repository', id],
    queryFn: () => repoAPI.get(id!),
    enabled: !!id,
  });

  const { data: statsData } = useQuery({
    queryKey: ['repository-stats', id],
    queryFn: () => repoAPI.statistics(id!),
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => repoAPI.upload(id!, file),
    onSuccess: () => { toast.success('Upload started — indexing in progress'); refetch(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Upload failed'),
  });

  const reindexMutation = useMutation({
    mutationFn: () => repoAPI.reindex(id!),
    onSuccess: () => { toast.success('Reindexing started'); refetch(); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Reindex failed'),
  });

  const repo = data?.data;
  const stats = statsData?.data;

  if (isLoading) return (
    <AppLayout>
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" label="Loading repository…" />
      </div>
    </AppLayout>
  );

  if (!repo) return (
    <AppLayout>
      <div className="p-8 text-center text-surface-400">Repository not found.</div>
    </AppLayout>
  );

  const statCards = [
    { label: 'Files', value: stats?.fileCount ?? '—', icon: FileCode, color: 'text-brand-400', bg: 'bg-brand-400/10' },
    { label: 'Chunks', value: stats?.chunkCount ?? '—', icon: FolderGit2, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
    { label: 'Functions', value: stats?.symbolCount ?? '—', icon: BarChart3, color: 'text-accent-violet', bg: 'bg-accent-violet/10' },
  ];

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Back */}
        <Link to="/repositories" className="inline-flex items-center gap-1 text-sm text-surface-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Repositories
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{repo.name}</h1>
            {repo.description && <p className="text-surface-400 mt-1">{repo.description}</p>}
            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${
              repo.status === 'ready' ? 'bg-accent-emerald/20 text-accent-emerald' :
              repo.status === 'indexing' ? 'bg-accent-amber/20 text-accent-amber' :
              'bg-surface-700 text-surface-400'
            }`}>
              {repo.status}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              id="upload-zip-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-700 hover:bg-surface-600 text-sm font-medium transition-all duration-200 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploadMutation.isPending ? 'Uploading…' : 'Upload ZIP'}
            </button>
            <button
              id="reindex-btn"
              onClick={() => reindexMutation.mutate()}
              disabled={reindexMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-sm font-medium transition-all duration-200 glow-brand disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${reindexMutation.isPending ? 'animate-spin' : ''}`} />
              Reindex
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = '';
          }}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-surface-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-surface-400">Repository ID</dt>
              <dd className="font-mono text-surface-300 text-xs">{repo._id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Created</dt>
              <dd className="text-surface-300">{new Date(repo.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    </AppLayout>
  );
}
