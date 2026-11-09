import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static acceptance checks against the real historical website, not an HQ mock.
// Keyboard activation and visual focus still require a browser check.
const source = readFileSync(new URL('../../AmericanSites  "Live"/index.html', import.meta.url), 'utf8');
const body = source.split(/<body\b[^>]*>/i)[1]?.split(/<\/body>/i)[0];
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
const skip = body?.match(/<a\b[^>]*class=["'][^"']*\bskip-link\b[^"']*["'][^>]*>[\s\S]*?<\/a>/i)?.[0];

test('first focusable element lets keyboard users skip repeated navigation', () => {
  assert.ok(body, 'Website body exists');
  assert.ok(skip, 'A skip-link anchor exists');
  const firstFocusable = body.match(/<(?:a\b[^>]*href\s*=|button\b|input\b|select\b|textarea\b|[^>]+\btabindex\s*=)[^>]*>/i)?.[0];
  assert.match(firstFocusable ?? '', /\bskip-link\b/, 'Skip link is before header links and controls');
  assert.equal(attr(skip, 'href'), '#top', 'Preserve existing main anchor');
  assert.match(skip.replace(/<[^>]+>/g, '').trim(), /^skip to main content$/i);
});

test('skip target is the unique programmatically focusable main landmark', () => {
  const matches = [...source.matchAll(/<[a-z][^>]*\bid=["']top["'][^>]*>/gi)];
  assert.equal(matches.length, 1, 'The target ID is unique');
  assert.match(matches[0]?.[0] ?? '', /^<main\b/i);
  assert.equal(attr(matches[0]?.[0] ?? '', 'tabindex'), '-1', 'Main can receive fragment focus without entering the Tab order');
});

test('skip link has local focus visibility styling above the sticky header', () => {
  const styles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const base = styles.match(/\.skip-link\s*\{([^}]+)\}/i)?.[1];
  const focused = styles.match(/\.skip-link:focus(?:-visible)?(?:\s*,\s*\.skip-link:focus(?:-visible)?)?\s*\{([^}]+)\}/i)?.[1];
  assert.ok(base, 'Inline base style works without Tailwind/CDN');
  assert.ok(focused, 'Focus makes skip link visible');
  assert.doesNotMatch(base, /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i, 'Link remains keyboard focusable');
  assert.match(base, /position\s*:\s*(?:fixed|absolute)/i);
  assert.ok(/(?:transform|top|left|clip)/i.test(base), 'Offscreen/collapsed resting position');
  assert.ok(/(?:transform|top|left|clip)/i.test(focused), 'Focus restores visible position');
  const z = Number(base.match(/z-index\s*:\s*(\d+)/i)?.[1] || focused.match(/z-index\s*:\s*(\d+)/i)?.[1]);
  assert.ok(z > 50, 'Link appears above header z-50');
  assert.match(`${base}\n${focused}`, /outline\s*:\s*(?!none|0(?:\s|;))[^;]+/i, 'Visible keyboard focus outline');
});
