import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { repoAPI, qaAPI } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { MessageSquare, Send, FileCode, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ filePath: string; startLine: number; endLine: number; symbolName?: string }>;
}

export default function QAPage() {
  const [question, setQuestion] = useState('');
  const [repoId, setRepoId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const { data: reposData } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => repoAPI.list(),
  });

  const repos = reposData?.data?.repositories ?? [];

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !repoId) {
      toast.error('Please enter a question and select a repository');
      return;
    }
    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setLoading(true);
    try {
      const res = await qaAPI.ask({ question, repositoryId: repoId, conversationId, topK: 5 });
      const d = res.data;
      if (d.conversationId) setConversationId(d.conversationId);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: d.answer,
        sources: d.sources,
      }]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Q&A request failed');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto flex flex-col h-[calc(100vh-0px)]">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Q&A</h1>
          <p className="text-surface-400 mt-1">Ask questions about your codebase with grounded answers</p>
        </div>

        {/* Repo selector */}
        <div className="glass rounded-xl p-4 mb-4">
          <select
            id="qa-repo-select"
            value={repoId}
            onChange={(e) => { setRepoId(e.target.value); setMessages([]); setConversationId(undefined); }}
            className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
          >
            <option value="">Select a repository…</option>
            {repos.map((r: any) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
          {messages.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center">
              <MessageSquare className="w-10 h-10 text-surface-500 mx-auto mb-3" />
              <p className="text-surface-400">Select a repository and ask a question to get started.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' ? 'bg-brand-600' : 'bg-accent-violet/30'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-accent-violet" />}
              </div>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                <div className={`glass rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-brand-600/20 border-brand-600/30' : ''
                }`}>
                  <p className="text-white whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1">
                    {msg.sources.map((s, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-surface-400">
                        <FileCode className="w-3 h-3 text-brand-400" />
                        <span className="font-mono text-accent-cyan">{s.filePath}</span>
                        <span>:{s.startLine}–{s.endLine}</span>
                        {s.symbolName && <span className="text-accent-violet">{s.symbolName}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent-violet/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-accent-violet" />
              </div>
              <div className="glass rounded-2xl px-4 py-3">
                <LoadingSpinner size="sm" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleAsk} className="glass rounded-xl p-3 flex gap-3">
          <input
            id="qa-question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your codebase…"
            disabled={loading || !repoId}
            className="flex-1 px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
          />
          <button
            id="qa-send-btn"
            type="submit"
            disabled={loading || !question.trim() || !repoId}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition-all duration-200 glow-brand"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
