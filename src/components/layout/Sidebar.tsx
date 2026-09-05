import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, CloudUpload as UploadCloud, ChartBar as FileBarChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UceLogo } from '@/components/UceLogo';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analyze', label: 'Analyze Project', icon: UploadCloud },
  { to: '/report', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 flex-col border-r bg-card md:flex">
      <Link to="/" className="flex h-16 items-center gap-2 border-b px-5">
        <UceLogo size="sm" />
      </Link>
      <nav className="flex-1 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Menu
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t p-4">
        <div className="rounded-md border bg-gradient-to-br from-primary/10 to-secondary/10 p-3">
          <p className="text-xs font-medium">UCE v2.0.0</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Deterministic compatibility analysis
          </p>
        </div>
      </div>
    </aside>
  );
}
