import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { authAPI } from '../../lib/api';
import toast from 'react-hot-toast';
import { Code2, Mail, Lock, User, UserPlus } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.displayName || form.displayName.length < 2) e.displayName = 'Name must be at least 2 characters';
    if (!form.email.includes('@')) e.email = 'Valid email required';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await authAPI.register(form);
      setAuth(res.data.token, res.data.user);
      toast.success('Account created! Welcome to RepoIntel 🎉');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (
    id: string, label: string, type: string,
    placeholder: string, Icon: React.ElementType,
    key: keyof typeof form
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-surface-300 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          id={id}
          type={type}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>
      {errors[key] && <p className="text-xs text-accent-rose mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-80 h-80 rounded-full bg-brand-600/15 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full bg-accent-cyan/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="glass rounded-3xl p-8 animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center mx-auto mb-4">
              <Code2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Create account</h1>
            <p className="text-surface-400 text-sm mt-1">Start exploring your repositories</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {field('displayName', 'Display Name', 'text', 'Your name', User, 'displayName')}
            {field('email', 'Email', 'email', 'you@example.com', Mail, 'email')}
            {field('password', 'Password', 'password', 'Min. 8 characters', Lock, 'password')}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 font-medium transition-all duration-200 glow-brand"
            >
              {loading ? <LoadingSpinner size="sm" /> : <><UserPlus className="w-4 h-4" /> Create Account</>}
            </button>
          </form>

          <p className="text-center text-sm text-surface-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
