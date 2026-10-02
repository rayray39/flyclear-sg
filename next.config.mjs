// GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so
// every asset URL needs that prefix. The deploy workflow sets the env var; local
// `npm run dev` leaves it unset and serves from the root as usual.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
export default {
  // Emit a plain static site into out/ — there is no server on Pages.
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
};
