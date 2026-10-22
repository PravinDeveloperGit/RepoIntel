import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { authAPI } from '../../lib/api';
import toast from 'react-hot-toast';
import { Code2, Mail, Lock, LogIn } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      setAuth(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.displayName}!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-brand-600/15 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent-violet/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="glass rounded-3xl p-8 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-violet flex items-center justify-center mx-auto mb-4">
              <Code2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-surface-400 text-sm mt-1">Sign in to RepoIntel</p>
          </div>

          {/* Quick Demo Credentials box */}
          <div className="mb-5 p-3 rounded-xl bg-surface-800/80 border border-brand-500/30 flex items-center justify-between text-xs">
            <div>
              <p className="text-surface-300 font-medium">Demo Account:</p>
              <p className="text-surface-400 font-mono text-[11px]">test@repointel.dev / Test1234!</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setForm({ email: 'test@repointel.dev', password: 'Test1234!' });
                setErrors({});
              }}
              className="px-2.5 py-1.5 rounded-lg bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 border border-brand-500/40 font-medium transition-colors"
            >
              Auto-Fill
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              {errors.email && <p className="text-xs text-accent-rose mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              {errors.password && <p className="text-xs text-accent-rose mt-1">{errors.password}</p>}
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200 glow-brand"
            >
              {loading ? <LoadingSpinner size="sm" /> : <><LogIn className="w-4 h-4" /> Sign In</>}
            </button>
          </form>

          <p className="text-center text-sm text-surface-400 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
