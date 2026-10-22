import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/layout/AppLayout';
import { Code2, Search, MessageSquare, FolderGit2 } from 'lucide-react';

const stats = [
  { label: 'Repositories', value: '—', icon: FolderGit2, color: 'text-brand-400', bg: 'bg-brand-400/10' },
  { label: 'Searches', value: '—', icon: Search, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
  { label: 'Q&A Sessions', value: '—', icon: MessageSquare, color: 'text-accent-violet', bg: 'bg-accent-violet/10' },
  { label: 'Code Chunks', value: '—', icon: Code2, color: 'text-accent-emerald', bg: 'bg-accent-emerald/10' },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back{user?.displayName ? `, ${user.displayName}` : ''}! 👋
          </h1>
          <p className="text-surface-400">Here's an overview of your repository intelligence workspace.</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5 glass-hover transition-all duration-300">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-surface-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Getting started card */}
        <div className="glass rounded-2xl p-8 border border-brand-600/20 text-center">
          <Code2 className="w-12 h-12 text-brand-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Get started with RepoIntel</h2>
          <p className="text-surface-400 mb-6 max-w-md mx-auto">
            Upload a repository ZIP to begin hybrid code search, Q&A, and evaluation experiments.
          </p>
          <a
            href="/repositories"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-medium transition-all duration-200 glow-brand"
          >
            <FolderGit2 className="w-4 h-4" /> Manage Repositories
          </a>
        </div>
      </div>
    </AppLayout>
  );
}
