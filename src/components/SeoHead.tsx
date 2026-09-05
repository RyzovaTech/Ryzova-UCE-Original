import { useEffect } from 'react';

type SeoHeadProps = {
  title: string;
  description: string;
  canonicalPath: string;
  indexable?: boolean;
};

const SITE_ORIGIN = 'https://uce.ryzova.com';
const LOGO_URL = `${SITE_ORIGIN}/uce-logo.svg`;

function upsertMeta(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => element!.setAttribute(key, value));
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let script = document.head.querySelector<HTMLScriptElement>(`script[data-seo-id="${id}"]`);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seoId = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function SeoHead({ title, description, canonicalPath, indexable = true }: SeoHeadProps) {
  useEffect(() => {
    const canonical = new URL(canonicalPath, SITE_ORIGIN).toString();
    document.title = title;

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;

    upsertMeta('meta[name="description"]', { name: 'description' }, description);
    upsertMeta('meta[name="robots"]', { name: 'robots' }, indexable ? 'index, follow' : 'noindex, nofollow');
    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title);
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description);
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonical);
    upsertMeta('meta[property="og:type"]', { property: 'og:type' }, 'website');
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, 'UCE — Universal Compatibility Engine');
    upsertMeta('meta[property="og:image"]', { property: 'og:image' }, LOGO_URL);
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' }, 'UCE — Universal Compatibility Engine logo');
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary');
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title);
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, LOGO_URL);
    upsertMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt' }, 'UCE — Universal Compatibility Engine logo');

    upsertJsonLd('page', {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonical,
      isPartOf: {
        '@type': 'WebSite',
        name: 'UCE — Universal Compatibility Engine',
        url: `${SITE_ORIGIN}/`,
      },
      about: {
        '@type': 'SoftwareApplication',
        name: 'UCE — Universal Compatibility Engine',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        url: `${SITE_ORIGIN}/`,
        image: LOGO_URL,
        description: 'An open-source, local-first software compatibility checker for Git repositories and project archives.',
        license: 'https://www.apache.org/licenses/LICENSE-2.0',
      },
    });
  }, [title, description, canonicalPath, indexable]);

  return null;
}
