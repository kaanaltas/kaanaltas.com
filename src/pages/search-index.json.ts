// The ⌘K palette's index as one static, cacheable file (built once), instead of
// a 34 KB JSON block repeated in every page. palette.ts fetches it while the
// browser is idle, and on the first intent to search.
import type { APIRoute } from 'astro';
import { buildIndex, groups } from '../data/search-index';

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ items: buildIndex(), groups }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
