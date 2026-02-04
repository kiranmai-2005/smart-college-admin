import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Upload,
  History,
  Settings,
  LogOut,
  GraduationCap,
  Calendar,
  Bell,
  ScrollText,
  Building2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/generate/circular', icon: ScrollText, label: 'Generate Circular' },
  { to: '/generate/notice', icon: Bell, label: 'Generate Notice' },
  { to: '/generate/timetable', icon: Calendar, label: 'Generate Timetable' },
  { to: '/upload', icon: Upload, label: 'Upload Documents' },
  { to: '/history', icon: History, label: 'Document History' },
  { to: '/settings', icon: Building2, label: 'College Settings' },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gradient-navy text-sidebar-foreground">
      {/* Logo Section */}
      <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold">
          <GraduationCap className="h-6 w-6 text-navy" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight">College Admin</span>
          <span className="text-xs text-gold">AI Assistant</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Main Menu
        </p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to.includes('/generate') && location.pathname.startsWith(item.to));
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-foreground border-l-2 border-gold'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-gold')} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-sidebar-accent/50 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-navy font-semibold text-sm">
            {user?.email?.[0].toUpperCase() || 'A'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
