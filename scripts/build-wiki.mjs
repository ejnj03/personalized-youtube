// Generates a GitHub-Wiki-ready `wiki/` folder from the in-repo docs.
//
// GitHub wikis are a SEPARATE git repo (github.com/<org>/<repo>.wiki.git) — you
// can't keep them as files in the main repo. So the docs live in-repo as the
// source of truth, and this script produces flat wiki pages from them, rewriting:
//   • doc-to-doc links      (theme.md            → Theme)
//   • repo source links     (../../apps/web/x.ts → <REPO>/blob/main/apps/web/x.ts)
// and leaving http(s) links alone. Anchors (#…) are preserved.
//
// Usage:
//   WIKI_REPO_BASE=https://github.com/me/showcase node scripts/build-wiki.mjs
//
// Then publish (one-time wiki init: create the first page in the GitHub UI):
//   git clone https://github.com/me/showcase.wiki.git
//   cp wiki/* showcase.wiki/ && cd showcase.wiki
//   git add . && git commit -m "docs: sync from repo" && git push

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = (process.env.WIKI_REPO_BASE || 'https://github.com/<org>/<repo>').replace(/\/$/, '');
const OUT = join(ROOT, 'wiki');

// source file (repo-relative) → wiki page name (GitHub uses the filename as the URL)
const PAGES = {
  'packages/sdk/README.md': 'Home',
  'packages/sdk/docs/getting-started.md': 'Getting-Started',
  'packages/sdk/docs/theme.md': 'Theme',
  'packages/sdk/docs/sections.md': 'Sections',
  'packages/sdk/docs/persistence.md': 'Persistence',
  'packages/sdk/docs/chat-panel.md': 'Chat-Panel',
  'packages/sdk/docs/server.md': 'Server',
  'packages/sdk/docs/concepts.md': 'Concepts',
};

// Map an absolute repo path back to its wiki page, if it's one of our docs.
const pageByAbs = new Map(Object.entries(PAGES).map(([src, page]) => [resolve(ROOT, src), page]));

function rewriteLinks(markdown, sourceAbs) {
  const srcDir = dirname(sourceAbs);
  // [text](target) and [text](target#anchor) — skip images-as-links edge cases minimally.
  return markdown.replace(/\]\(([^)\s]+)\)/g, (whole, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return whole; // external or in-page anchor
    const [path, anchor = ''] = target.split('#');
    const abs = resolve(srcDir, path);
    const hash = anchor ? `#${anchor}` : '';

    const page = pageByAbs.get(abs);
    if (page) return `](${page}${hash})`; // doc → wiki page

    if (existsSync(abs)) {
      const rel = relative(ROOT, abs);
      const kind = existsSync(abs) && abs.endsWith('/') ? 'tree' : 'blob';
      // dirs come through without trailing slash; detect via fs stat-free heuristic:
      const isDir = !/\.[a-z0-9]+$/i.test(rel);
      return `](${REPO}/${isDir ? 'tree' : 'blob'}/main/${rel}${hash})`;
    }
    return whole; // unknown — leave as authored
  });
}

mkdirSync(OUT, { recursive: true });

for (const [src, page] of Object.entries(PAGES)) {
  const abs = resolve(ROOT, src);
  const out = rewriteLinks(readFileSync(abs, 'utf8'), abs);
  writeFileSync(join(OUT, `${page}.md`), out);
}

// Sidebar (shown on every wiki page).
const sidebar = `### 🧩 @showcase/sdk

- [[Home]]
- [[Getting Started|Getting-Started]]
- [[Theme]]
- [[Sections]]
- [[Persistence]]
- [[Chat Panel|Chat-Panel]]
- [[Server]]
- [[Concepts]]

---
[↩ Back to the repo](${REPO})
`;
writeFileSync(join(OUT, '_Sidebar.md'), sidebar);
writeFileSync(join(OUT, '_Footer.md'), `<sub>Generated from \`packages/sdk/docs/\` — edit there, not here. Run \`node scripts/build-wiki.mjs\` to regenerate.</sub>\n`);

console.log(`✓ Wrote ${Object.keys(PAGES).length} pages + sidebar/footer to ${relative(ROOT, OUT)}/`);
console.log(`  Repo base: ${REPO}${REPO.includes('<org>') ? '  ← set WIKI_REPO_BASE to fix source links' : ''}`);
console.log('  Publish: clone <repo>.wiki.git, copy wiki/* in, commit, push.');
