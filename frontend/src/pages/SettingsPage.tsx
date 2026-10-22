import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/layout/AppLayout';
import { Settings, User, Shield, Code2 } from 'lucide-react';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-surface-400 mt-1">Manage your account and preferences</p>
        </div>

        {/* Profile card */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-400" /> Profile
          </h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium text-surface-400 mb-1">Display Name</dt>
              <dd className="text-sm text-white bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5">
                {user?.displayName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-surface-400 mb-1">Email</dt>
              <dd className="text-sm text-white bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5">
                {user?.email ?? '—'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Security card */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent-emerald" /> Security
          </h2>
          <p className="text-sm text-surface-400">
            Your password is securely stored. Contact an administrator to reset it.
          </p>
        </div>

        {/* About card */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent-violet" /> About RepoIntel
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-surface-400">Version</dt>
              <dd className="text-surface-300 font-mono">1.0.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Stack</dt>
              <dd className="text-surface-300">FastAPI · React · MongoDB · Qdrant</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Project</dt>
              <dd className="text-surface-300">Final Year B.Tech IT</dd>
            </div>
          </dl>
        </div>

        <p className="text-center text-xs text-surface-600 mt-8 flex items-center justify-center gap-1">
          <Settings className="w-3 h-3" /> More settings coming soon
        </p>
      </div>
    </AppLayout>
  );
}
