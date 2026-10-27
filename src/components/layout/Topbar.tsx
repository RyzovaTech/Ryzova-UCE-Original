import { Link, useNavigate, NavLink } from 'react-router-dom';
import { Moon, Sun, CloudUpload as UploadCloud, Menu, LayoutDashboard, ChartBar as FileBarChart, Settings, BookOpen, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { Sheet, SheetClose, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { UceLogo } from '@/components/UceLogo';
import { COMMUNITY_LINKS } from '@/lib/community-links';

const mobileItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analyze', label: 'Analyze Project', icon: UploadCloud },
  { to: '/report', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/catalog', label: 'UCE Catalog', icon: BookOpen },
];

export function Topbar() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 min-w-0 w-full max-w-full items-center gap-2 border-b bg-background px-3 sm:gap-3 sm:px-4 md:px-6">
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-16 items-center gap-2 border-b px-5">
              <UceLogo size="sm" />
            </div>
            <nav className="px-3 py-4">
              <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Menu
              </p>
              <ul className="space-y-1">
                {mobileItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <SheetClose asChild>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                      </SheetClose>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 border-t px-3 pt-3">
                <SheetClose asChild>
                  <a
                    href={COMMUNITY_LINKS.discussions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    GitHub Community
                  </a>
                </SheetClose>
                <SheetClose asChild>
                  <a
                    href={COMMUNITY_LINKS.feedback}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Share Feedback
                  </a>
                </SheetClose>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <Link to="/" className="shrink-0 md:hidden" aria-label="UCE home">
        <UceLogo size="sm" showText={false} />
      </Link>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button size="sm" onClick={() => navigate('/analyze')} className="gap-2">
          <UploadCloud className="h-4 w-4" />
          <span className="hidden sm:inline">Analyze Project</span>
          <span className="sm:hidden">Analyze</span>
        </Button>
      </div>
    </header>
  );
}
