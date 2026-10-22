import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { repoAPI, searchAPI } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { Search, FileCode, Zap } from 'lucide-react';

interface SearchResult {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
  symbolName?: string;
  symbolType?: string;
}

const MODES = [
  { value: 'hybrid', label: 'Hybrid (RRF)' },
  { value: 'bm25', label: 'BM25 Only' },
  { value: 'vector', label: 'Vector Only' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [repoId, setRepoId] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const { data: reposData } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => repoAPI.list(),
  });

  const repos = reposData?.data?.repositories ?? [];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !repoId) {
      toast.error('Please enter a query and select a repository');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchAPI.search({ query, repositoryId: repoId, mode, topK: 10 });
      setResults(res.data.results ?? []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Code Search</h1>
          <p className="text-surface-400 mt-1">Hybrid semantic code search across your repositories</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="glass rounded-2xl p-6 mb-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Repository</label>
            <select
              id="search-repo-select"
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
            >
              <option value="">Select a repository…</option>
              {repos.map((r: any) => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                id="search-query-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Where is JWT authentication implemented?"
                className="w-full pl-10 pr-4 py-3 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    mode === m.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-700 text-surface-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              id="search-submit-btn"
              type="submit"
              disabled={loading}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-sm font-medium transition-all duration-200 glow-brand"
            >
              {loading ? <LoadingSpinner size="sm" /> : <><Zap className="w-4 h-4" /> Search</>}
            </button>
          </div>
        </form>

        {/* Results */}
        {loading && (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="Searching…" /></div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center">
            <Search className="w-10 h-10 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-400">No results found. Try a different query or repository.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((r, i) => (
              <div key={r.chunkId} className="glass rounded-xl p-5 glass-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <span className="font-mono text-sm text-accent-cyan">{r.filePath}</span>
                    <span className="text-xs text-surface-500">Lines {r.startLine}–{r.endLine}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.symbolName && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-violet/20 text-accent-violet">{r.symbolName}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300">Rank {i + 1}</span>
                  </div>
                </div>
                <pre className="text-xs text-surface-300 bg-surface-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {r.content.slice(0, 500)}{r.content.length > 500 ? '…' : ''}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
