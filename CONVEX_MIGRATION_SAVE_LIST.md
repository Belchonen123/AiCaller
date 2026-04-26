# Convex Migration Save Package

This package preserves the source files most useful for rebuilding or migrating the app to Convex.

## Included

- `app/` - Next.js pages, layouts, route handlers, server actions, and feature UI.
- `components/` - Shared UI system and reusable components.
- `lib/` - Retell integration, campaign dispatching, CSV parsing, auth helpers, formatting, and utilities.
- `supabase/migrations/` - Current database schema reference for designing Convex tables/functions.
- `scripts/` - Seed, dispatch, accessibility, and code export helpers.
- `design/`, `docs/`, `public/` - Supporting assets and documentation.
- Root config files such as `package.json`, `tsconfig.json`, `next.config.ts`, `components.json`, and `vercel.json`.

## Excluded

- `.env.local` and other local secret files.
- `node_modules/`, `.next/`, build output, caches, and TypeScript build info.
- Lockfiles and generated code review bundles.

## Notes

For Convex, use `supabase/migrations/` as the schema reference, then port data access module by module instead of rewriting the UI from scratch.
