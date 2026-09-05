import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { Loader as Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { SeoHead } from '@/components/SeoHead';

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AnalyzePage = lazy(() => import('@/pages/AnalyzePage').then(m => ({ default: m.AnalyzePage })));
const ReportPage = lazy(() => import('@/pages/ReportPage').then(m => ({ default: m.ReportPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function RouteSeo() {
  const location = useLocation();
  const pathname = location.pathname;

  const seo = pathname === '/'
    ? {
        title: 'UCE — Universal Compatibility Engine',
        description: 'UCE is an open-source software compatibility checker for Git repositories and project archives, with local-first dependency and configuration analysis.',
        canonicalPath: '/',
        indexable: true,
      }
    : pathname === '/analyze'
      ? {
          title: 'Analyze a Project — UCE',
          description: 'Analyze a ZIP archive or public GitHub repository with deterministic, browser-based compatibility checks.',
          canonicalPath: '/analyze',
          indexable: true,
        }
      : pathname === '/dashboard'
        ? {
            title: 'Dashboard — UCE',
            description: 'Review your locally stored UCE compatibility analysis history and project health reports.',
            canonicalPath: '/dashboard',
            indexable: false,
          }
        : pathname === '/settings'
          ? {
              title: 'Settings — UCE',
              description: 'Manage UCE preferences and locally stored analysis data.',
              canonicalPath: '/settings',
              indexable: false,
            }
          : {
              title: 'Compatibility Report — UCE',
              description: 'View a locally generated UCE software compatibility analysis report.',
              canonicalPath: pathname,
              indexable: false,
            };

  return <SeoHead {...seo} />;
}

function CrawlableSiteNav() {
  return (
    <nav aria-label="Public UCE pages" className="sr-only">
      <Link to="/">UCE Home</Link>
      <Link to="/analyze">Analyze a Project</Link>
    </nav>
  );
}

function AnalyzeRoute() {
  return (
    <>
      <section aria-labelledby="analyze-guide" className="sr-only">
        <h2 id="analyze-guide">How UCE analyzes your project</h2>
        <p>
          UCE analyzes ZIP archives and public GitHub repositories in your browser. It detects project structure,
          languages, frameworks, runtimes, package managers, dependencies, lockfiles, configuration, and compatibility risks,
          then produces a scored engineering report.
        </p>
      </section>
      <AnalyzePage />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RouteSeo />
      <CrawlableSiteNav />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<Navigate to="/" replace />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="/analyze" element={<Suspense fallback={<PageLoader />}><AnalyzeRoute /></Suspense>} />
          <Route path="/report" element={<Suspense fallback={<PageLoader />}><ReportPage /></Suspense>} />
          <Route path="/report/:id" element={<Suspense fallback={<PageLoader />}><ReportPage /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
