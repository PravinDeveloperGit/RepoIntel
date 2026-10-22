import { Link, useNavigate } from 'react-router-dom';
import {
  Code2, Search, GitBranch, Zap, Shield, BarChart3,
  ArrowRight, Star, ChevronRight
} from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Hybrid Semantic Search',
    description: 'Combines BM25 lexical retrieval with dense vector search using Reciprocal Rank Fusion for superior code discovery.',
    color: 'text-accent-cyan',
    bg: 'bg-accent-cyan/10',
  },
  {
    icon: Zap,
    title: 'Code-Aware Reranking',
    description: 'Multi-feature reranker scores results by identifier match, file path, symbol type, imports, and semantic similarity.',
    color: 'text-brand-400',
    bg: 'bg-brand-400/10',
  },
  {
    icon: GitBranch,
    title: 'Repository Context',
    description: 'Extracts import graphs, call relationships, and class hierarchies to surface related code automatically.',
    color: 'text-accent-emerald',
    bg: 'bg-accent-emerald/10',
  },
  {
    icon: Shield,
    title: 'Grounded Q&A',
    description: 'Evidence-based answers with verified citations. Never fabricates file names, line numbers, or functions.',
    color: 'text-accent-amber',
    bg: 'bg-accent-amber/10',
  },
  {
    icon: BarChart3,
    title: 'Research Evaluation',
    description: 'Compare System A-E variants. Measure Success@K, MRR, Precision@K, and latency with reproducible experiments.',
    color: 'text-accent-violet',
    bg: 'bg-accent-violet/10',
  },
  {
    icon: Code2,
    title: 'Multi-Language Support',
    description: 'Tree-sitter powered parsing for Python, JavaScript, and TypeScript with syntax-aware chunking.',
    color: 'text-accent-rose',
    bg: 'bg-accent-rose/10',
  },
];

const systems = [
  { label: 'A', name: 'BM25 Baseline', desc: 'Lexical retrieval only' },
  { label: 'B', name: 'Vector Baseline', desc: 'Dense retrieval only' },
  { label: 'C', name: 'Hybrid RRF', desc: 'BM25 + Vector fusion' },
  { label: 'D', name: 'Hybrid + Rerank', desc: 'Fusion with code-aware reranking' },
  { label: 'E', name: 'Full System', desc: 'Reranking + repository context' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-950 text-white overflow-hidden">
      {/* Gradient background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-accent-violet/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-accent-cyan/10 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-surface-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-violet flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold">RepoIntel</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-surface-300 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-sm font-medium transition-all duration-200 glow-brand"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-brand-600/30 text-sm text-brand-300 mb-8">
          <Star className="w-4 h-4" />
          <span>Final Year B.Tech IT Project — Repository Intelligence</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="gradient-text">Hybrid Code Search</span>
          <br />
          <span className="text-white">that actually understands</span>
          <br />
          <span className="text-surface-300">your repository</span>
        </h1>

        <p className="text-xl text-surface-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Combines BM25 lexical retrieval, dense vector search, code-aware reranking,
          and structural context to answer repository-level questions with verified citations.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <button
            onClick={() => navigate('/register')}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 font-semibold text-lg transition-all duration-200 glow-brand pulse-glow"
          >
            Start Exploring <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl glass glass-hover font-semibold text-lg"
          >
            Sign In <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Mock search bar */}
        <div className="glass rounded-2xl p-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 text-left">
            <Search className="w-5 h-5 text-brand-400 flex-shrink-0" />
            <span className="text-surface-300 text-sm">
              "Where is JWT authentication middleware implemented?"
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-surface-700 space-y-2">
            {[
              { file: 'src/middleware/auth.js', lines: '12–31', symbol: 'verifyToken' },
              { file: 'src/config/jwt.js', lines: '1–18', symbol: 'jwtConfig' },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono text-accent-cyan">{r.file}</span>
                <span className="text-surface-400">Lines {r.lines} · {r.symbol}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${i === 0 ? 'bg-brand-600/20 text-brand-300' : 'bg-surface-700 text-surface-400'}`}>
                  {i === 0 ? 'Rank 1' : 'Rank 2'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Research Contributions</h2>
        <p className="text-surface-400 text-center mb-12">
          A systematic comparison of retrieval baselines with measurable evaluation
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 glass-hover transition-all duration-300">
              <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon className={`w-6 h-6 ${f.color}`} />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-surface-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Systems comparison */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Evaluation Systems</h2>
        <p className="text-surface-400 text-center mb-10">
          Five retrieval system variants compared using standard IR metrics
        </p>
        <div className="flex flex-col gap-3">
          {systems.map((sys, i) => (
            <div
              key={sys.label}
              className={`flex items-center gap-4 glass rounded-xl p-4 transition-all duration-200 ${i === 4 ? 'border-brand-600/30 bg-brand-900/20' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${i === 4 ? 'bg-brand-600 text-white' : 'bg-surface-700 text-surface-300'}`}>
                {sys.label}
              </div>
              <div className="flex-1">
                <p className="font-medium text-white text-sm">{sys.name}</p>
                <p className="text-xs text-surface-400">{sys.desc}</p>
              </div>
              {i === 4 && (
                <span className="text-xs px-2 py-1 rounded-full bg-brand-600/20 text-brand-300">
                  Proposed
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-2xl mx-auto px-8 py-20 text-center">
        <div className="glass rounded-3xl p-12 border border-brand-600/20">
          <Code2 className="w-12 h-12 text-brand-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Ready to explore?</h2>
          <p className="text-surface-400 mb-8">
            Upload a repository ZIP and run hybrid code search in minutes.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 font-semibold transition-all duration-200 glow-brand"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 text-center py-8 text-surface-500 text-sm border-t border-surface-800">
        <p>Repository Intelligence · Final Year IT Project · Built with FastAPI + React + MongoDB</p>
      </footer>
    </div>
  );
}
