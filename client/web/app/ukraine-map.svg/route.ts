import {
  MAP_BACKGROUND,
  MAP_BORDER,
  UKRAINE_MAP_PATHS,
} from '@/lib/ukraineMap';

export const dynamic = 'force-static';

export function GET() {
  const paths = UKRAINE_MAP_PATHS.map(
    (d) =>
      `<path fill="${MAP_BACKGROUND}" stroke="${MAP_BORDER}" stroke-linejoin="round" stroke-width=".8" d="${d}"/>`,
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 1000 670">${paths}</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
