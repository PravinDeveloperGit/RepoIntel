import { useQuery } from '@tanstack/react-query';
import { searchAPI } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { History, Search, Clock } from 'lucide-react';

interface HistoryItem {
  _id: string;
  query: string;
  mode: string;
  resultsCount: number;
  createdAt: string;
}

export default function SearchHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['search-history'],
    queryFn: () => searchAPI.history(1, 50),
  });

  const history: HistoryItem[] = data?.data?.history ?? [];

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Search History</h1>
          <p className="text-surface-400 mt-1">Your past search queries and results</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" label="Loading history…" /></div>
        ) : history.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <History className="w-12 h-12 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-400">No search history yet. Start searching to see results here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item._id} className="glass rounded-xl p-4 glass-hover flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-brand-400/10 flex items-center justify-center flex-shrink-0">
                  <Search className="w-4 h-4 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.query}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-700 text-surface-400">{item.mode}</span>
                    <span className="text-xs text-surface-500">{item.resultsCount} results</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-surface-500 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
