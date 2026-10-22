import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { authAPI } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  FolderGit2,
  Search,
  MessageSquare,
  BarChart3,
  History,
  Settings,
  LogOut,
  Code2,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/repositories', icon: FolderGit2, label: 'Repositories' },
  { to: '/search', icon: Search, label: 'Code Search' },
  { to: '/qa', icon: MessageSquare, label: 'Q&A' },
  { to: '/evaluation', icon: BarChart3, label: 'Evaluation' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearAuth, user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore error
    }
    clearAuth();
    navigate('/');
    toast.success('Logged out successfully');
  };

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen sticky top-0 glass border-r border-surface-700 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-surface-700">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-violet flex items-center justify-center flex-shrink-0">
          <Code2 className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold text-white">RepoIntel</h1>
            <p className="text-xs text-surface-400">Code Intelligence</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-surface-400 hover:text-white transition-colors"
        >
          {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-600/30'
                  : 'text-surface-300 hover:text-white hover:bg-surface-700/50'
              )}
            >
              <item.icon className={clsx('w-5 h-5 flex-shrink-0', active && 'text-brand-400')} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-surface-700">
        {!collapsed && user && (
          <div className="mb-3 px-3">
            <p className="text-xs font-medium text-white truncate">{user.displayName}</p>
            <p className="text-xs text-surface-400 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-surface-400 hover:text-accent-rose hover:bg-accent-rose/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
