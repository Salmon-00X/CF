# Registry Decision — @efferd dropped

**Date:** 2026-06-18
**Context:** UI shell redesign (slice 1) originally specified the efferd `dashboard-7`
template via a third-party `@efferd` shadcn registry.

**Finding:** The registry endpoint requires payment. Probe results:

| URL | Status |
|-----|--------|
| `https://efferd.com/r/dashboard-7.json` | 401 Unauthorized |
| `https://efferd.com/r/new-york/dashboard-7.json` | 401 Unauthorized |
| `https://efferd.com/view/dashboard-7` | 200 (public preview HTML only) |

401 body: `"To unlock this Paid Block, we need your EFFERD_REGISTRY_TOKEN."` — dashboard-7
is a paid block.

**Decision:** User chose to **build the dashboard layout by hand** from official, free
shadcn primitives styled Ford Blue. No `@efferd` registry is registered; no token is
stored. `components.json` carries no `registries` block.

**Effect on plan:** Task 2 becomes a recorded decision (no install). Task 5 builds
`AppShell.tsx` by hand on the shadcn `sidebar` primitive instead of pulling a template.
No auth-strip needed (nothing pulls login). System font stack (CSP-safe).
