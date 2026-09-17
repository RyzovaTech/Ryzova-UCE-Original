import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { Loader as Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LandingPage } from "@/pages/LandingPage";
import { SeoHead } from "@/components/SeoHead";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const AnalyzePage = lazy(() =>
  import("@/pages/AnalyzePage").then((m) => ({ default: m.AnalyzePage })),
);
const ReportPage = lazy(() =>
  import("@/pages/ReportWithLanguageBreakdownPage").then((m) => ({
    default: m.ReportWithLanguageBreakdownPage,
  })),
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

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
  const seo =
    pathname === "/"
      ? {
          title: "Ryzova UCE — Universal Compatibility Engine",
          description:
            "Ryzova UCE is the Universal Compatibility Engine, an open-source developer tool from Ryzova for analyzing software projects and identifying compatibility issues.",
          canonicalPath: "/",
          indexable: true,
        }
      : pathname === "/analyze"
        ? {
            title: "Software Compatibility Analyzer — Ryzova UCE",
            description:
              "Analyze a ZIP archive or public GitHub repository with Ryzova UCE's deterministic, browser-based software compatibility checks.",
            canonicalPath: "/analyze",
            indexable: true,
          }
        : pathname === "/dashboard"
          ? {
              title: "Dashboard — UCE",
              description:
                "Review your locally stored UCE compatibility analysis history and project health reports.",
              canonicalPath: "/dashboard",
              indexable: false,
            }
          : pathname === "/settings"
            ? {
                title: "Settings — UCE",
                description: "Manage UCE preferences and locally stored analysis data.",
                canonicalPath: "/settings",
                indexable: false,
              }
            : {
                title: "Compatibility Report — UCE",
                description: "View a locally generated UCE software compatibility analysis report.",
                canonicalPath: pathname,
                indexable: false,
              };
  return <SeoHead {...seo} />;
}

function PublicLinksFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-6 text-sm md:px-8">
        <Link to="/" className="font-medium text-foreground hover:text-primary">
          UCE Home
        </Link>
        <Link to="/analyze" className="font-medium text-foreground hover:text-primary">
          Analyze a Project
        </Link>
        <span className="text-muted-foreground">
          Open-source, local-first compatibility analysis
        </span>
        <a
          href="https://www.ryzova.com/"
          className="font-medium text-foreground hover:text-primary"
        >
          Built by Ryzova™
        </a>
      </div>
    </footer>
  );
}

function AnalyzeRoute() {
  return (
    <>
      <section aria-labelledby="analyze-guide" className="mb-6 rounded-lg border bg-muted/30 p-5">
        <h2 id="analyze-guide" className="text-lg font-semibold tracking-tight">
          How UCE analyzes your project
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ryzova UCE analyzes ZIP archives and public GitHub repositories in your browser. It
          detects project structure, languages, frameworks, runtimes, package managers,
          dependencies, lockfiles, configuration, and compatibility risks, then produces a scored
          engineering report.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ryzova UCE is an open-source developer tool from{" "}
          <a
            href="https://www.ryzova.com/"
            className="font-medium text-foreground hover:text-primary"
          >
            Ryzova™
          </a>
          . Its source is available in the{" "}
          <a
            href="https://github.com/RyzovaTech/Ryzova-UCE-Original"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary"
          >
            official Ryzova UCE GitHub repository
          </a>
          .
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
      <Routes>
        <Route
          path="/"
          element={
            <>
              <LandingPage />
              <PublicLinksFooter />
            </>
          }
        />
        <Route path="/pricing" element={<Navigate to="/" replace />} />
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="/analyze"
            element={
              <Suspense fallback={<PageLoader />}>
                <AnalyzeRoute />
              </Suspense>
            }
          />
          <Route
            path="/report"
            element={
              <Suspense fallback={<PageLoader />}>
                <ReportsPage />
              </Suspense>
            }
          />
          <Route
            path="/report/:id"
            element={
              <Suspense fallback={<PageLoader />}>
                <ReportPage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
