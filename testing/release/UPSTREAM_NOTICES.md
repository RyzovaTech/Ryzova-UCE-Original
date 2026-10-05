# Upstream manifest excerpt attribution

These excerpts are offline detector evaluation inputs. They retain the upstream licenses; they are not relicensed as Ryzova application code. Exact source commits, paths, URLs, full-source hashes and excerpt methods are recorded in `manifest-corpus.json`. License texts below are copied from those commits.

| Upstream | License | Retained text |
| --- | --- | --- |
| pallets/click | BSD-3-Clause | licenses/pallets-click.txt |
| psf/requests | Apache-2.0 | licenses/psf-requests.txt |
| fastapi/fastapi | MIT | licenses/fastapi-fastapi.txt |
| denoland/deno | MIT | licenses/denoland-deno.txt |
| prometheus/prometheus | Apache-2.0 | licenses/prometheus-prometheus.txt; licenses/prometheus-NOTICE.txt |
| symfony/symfony | MIT | licenses/symfony-symfony.txt |
| vercel/next.js | MIT | licenses/vercel-next.js.txt |
| vuejs/core | MIT | licenses/vuejs-core.txt |

JSON manifests retain selected identity/dependency/license fields. TOML excerpts retain leading complete metadata sections; the Go module file is retained in full. These transformations preserve the fields used by the frozen labels; no source or dependency declaration is fabricated. This collection makes no whole-repository negative or license-compliance assessment of upstream projects.
