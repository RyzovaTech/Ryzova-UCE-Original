import { useDeferredValue, useMemo, useState } from 'react';
import { BookOpen, Boxes, Braces, Bug, Code2, Globe2, Search, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UCE_CATALOG_COUNTS, UCE_CATALOG_ITEMS, type CatalogItem, type CatalogSection } from '@/lib/catalog';

const sections: Array<{ id: 'all' | CatalogSection; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'languages', label: 'Languages' }, { id: 'technologies', label: 'Technologies' },
  { id: 'architecture', label: 'Architecture' }, { id: 'browser', label: 'Browser' }, { id: 'security', label: 'Security' }, { id: 'intelligence', label: 'Intelligence' },
];
const metrics = [
  ['Languages', UCE_CATALOG_COUNTS.languages, Code2], ['Technologies', UCE_CATALOG_COUNTS.technologies, Boxes],
  ['Architecture', UCE_CATALOG_COUNTS.architecture, Braces], ['Browser rules', UCE_CATALOG_COUNTS.browser, Globe2],
  ['Security rules', UCE_CATALOG_COUNTS.security, ShieldCheck], ['Intelligence', UCE_CATALOG_COUNTS.intelligence, Bug],
] as const;
const RESULT_LIMIT = 150;

function CatalogDetail({ item }: { item: CatalogItem }) {
  return (
    <div>
      <DialogHeader>
        <div className="flex flex-wrap gap-2"><Badge>{item.category}</Badge><Badge variant="outline">{item.status}</Badge></div>
        <DialogTitle className="pt-2 text-xl">{item.name}</DialogTitle>
        <DialogDescription className="text-sm leading-6">{item.description}</DialogDescription>
      </DialogHeader>
      <div className="mt-5 space-y-5">
        <div><h3 className="text-sm font-semibold">How UCE recognizes it</h3><ul className="mt-2 space-y-2 text-sm text-muted-foreground">{item.evidence.map((value) => <li key={value} className="rounded-md bg-muted/60 px-3 py-2">{value}</li>)}</ul></div>
        {item.recommendation ? <div><h3 className="text-sm font-semibold">Recommendation</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.recommendation}</p></div> : null}
        <div className="border-t pt-4 text-xs text-muted-foreground">Knowledge version {item.version} · Detection results depend on available project evidence.</div>
      </div>
    </div>
  );
}

export function CatalogPage() {
  const { section: routeSection } = useParams<{ section?: string }>();
  const section: 'all' | CatalogSection = sections.some((item) => item.id === routeSection) ? routeSection as CatalogSection : 'all';
  const [query, setQuery] = useState(''); const deferredQuery = useDeferredValue(query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = useMemo(() => { const needle = deferredQuery.trim().toLowerCase(); return UCE_CATALOG_ITEMS.filter((item) => (section === 'all' || item.section === section) && (!needle || `${item.name} ${item.category} ${item.description} ${item.evidence.join(' ')}`.toLowerCase().includes(needle))); }, [deferredQuery, section]);
  const visible = filtered.slice(0, RESULT_LIMIT); const selected = selectedId ? UCE_CATALOG_ITEMS.find((item) => item.id === selectedId) : undefined;
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="flex items-start gap-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><BookOpen className="h-6 w-6" /></div><div><h1 className="text-2xl font-semibold tracking-tight">UCE Catalog</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Explore 77 language labels, 639 technology definitions, 105 browser rules, 40 security checks, 22 architecture patterns, and 21 intelligence capabilities understood by Ryzova UCE™. Catalog entries describe deterministic knowledge—not a guarantee that every project has enough evidence for detection.</p></div></div>
      </section>
      <section aria-label="Catalog coverage" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{metrics.map(([label, value, Icon]) => <Card key={label}><CardContent className="flex items-center gap-3 p-4"><Icon className="h-5 w-5 text-primary" /><div><p className="text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>)}</section>
      <div className="space-y-3"><label htmlFor="catalog-search" className="text-sm font-medium">Search UCE knowledge</label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="catalog-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search React, Python, WebGPU, Docker, SQL injection…" className="pl-9" /></div><nav className="flex flex-wrap gap-2" aria-label="Catalog section">{sections.map((item) => <Button key={item.id} size="sm" variant={section === item.id ? 'default' : 'outline'} asChild><Link to={item.id === 'all' ? '/catalog' : `/catalog/${item.id}`}>{item.label}</Link></Button>)}</nav></div>
      <div>
        <section aria-live="polite"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{filtered.length.toLocaleString()} matching entries</h2>{filtered.length > RESULT_LIMIT ? <span className="text-xs text-muted-foreground">Showing first {RESULT_LIMIT}</span> : null}</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><h3 className="font-medium">{item.name}</h3><Badge variant="secondary" className="shrink-0 text-[10px]">{item.category}</Badge></div><p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{item.description}</p></button>)}</div>
          {visible.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No catalog entries match this search.</div> : null}
        </section>
      </div>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">{selected ? <CatalogDetail item={selected} /> : null}</DialogContent></Dialog>
    </div>
  );
}
