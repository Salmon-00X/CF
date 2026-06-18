# Frontend Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Vitest + Testing Library harness and cover the frontend's highest-value interaction logic (readings grid editing, filter sync, useFilters reducer, topbar handlers, problem-zone click).

**Architecture:** Vitest reads the existing `vite.config.ts` (add a `test` block, jsdom env). Tests mock the API boundary (`../lib/api`), `sonner`, and the shared engines, so they exercise component behavior deterministically without network/DB/engine coupling. A setup file polyfills the jsdom gaps Radix + the shadcn sidebar need.

**Tech Stack:** Vitest, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom; React 18 + Vite 5.

## Global Constraints

- **Branch:** `feat/frontend-tests`.
- **Tests only:** no production source changes (no version bump, no desktop rebuild). The shared engines (15 tests) and backend (22 tests) stay untouched and green.
- **Preserve `vite.config.ts`:** keep every existing key (`base`, `resolve.alias`, `optimizeDeps`, `build.commonjsOptions`, plugins); only ADD a `test` block.
- **Mock boundary:** `vi.mock('../lib/api')`, `vi.mock('sonner')`, and mock `../lib/shared` members used (deterministic; avoids UMD/CJS interop in vitest).
- **jsdom polyfills** (in `src/test/setup.ts`): `window.matchMedia` (shadcn `use-mobile`), `Element.prototype.scrollIntoView` / `hasPointerCapture` / `setPointerCapture` / `releasePointerCapture` (Radix AlertDialog/Select).
- **Native `<select>`** editors in ReadingsGrid test cleanly; the only Radix Select is in AppTopbar — its test covers the reliable button/view-switch handlers, not the flaky Radix open-and-pick.
- **Gate:** `npm test -w @cf-wavescan/frontend` green + pristine; `vite build` + `tsc --noEmit` still clean.

---

## File Structure

**New:**
- `frontend/src/test/setup.ts` — jest-dom matchers, cleanup, jsdom polyfills
- `frontend/src/hooks/useFilters.test.ts`
- `frontend/src/components/data/ReadingsGrid.test.tsx`
- `frontend/src/components/ProblemZones.test.tsx`
- `frontend/src/components/shell/AppTopbar.test.tsx`

**Modified:** `frontend/vite.config.ts` (add `test` block), `frontend/package.json` (deps + script).

---

### Task 1: Harness + useFilters smoke test

**Files:** Modify `frontend/package.json`, `frontend/vite.config.ts`; Create `frontend/src/test/setup.ts`, `frontend/src/hooks/useFilters.test.ts`.

**Interfaces:** Produces a runnable `npm test -w @cf-wavescan/frontend`; the setup file's polyfills are relied on by all later component tests.

- [ ] **Step 1: Install dev-deps**

```bash
npm -w @cf-wavescan/frontend i -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Add the `test` block to `frontend/vite.config.ts`**

Add this key to the `defineConfig({ … })` object (alongside `base`, `server`, etc. — do not remove anything):
```ts
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
```
If TypeScript complains that `test` is not a known Vite config key, change the top import to `import { defineConfig } from 'vitest/config';` (drop-in superset of Vite's `defineConfig`).

- [ ] **Step 3: Create `frontend/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// jsdom lacks matchMedia (shadcn sidebar's use-mobile hook reads it).
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// Radix (AlertDialog/Select) calls these; jsdom doesn't implement them.
const proto = Element.prototype as any;
if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn();
if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn();
if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn();
```

- [ ] **Step 4: Add the test script to `frontend/package.json`**

In `scripts`, add:
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 5: Write `frontend/src/hooks/useFilters.test.ts`**

```ts
import { renderHook, act } from '@testing-library/react';
import { useFilters } from './useFilters';

test('update merges a patch without dropping other keys', () => {
  const { result } = renderHook(() => useFilters());
  act(() => result.current.update({ model: 'Raptor' }));
  expect(result.current.filters.model).toBe('Raptor');
  expect(result.current.filters.periodPreset).toBe('single'); // untouched
});

test('reset restores the default filter values', () => {
  const { result } = renderHook(() => useFilters());
  act(() => result.current.update({ model: 'Raptor', chartType: 'pareto' }));
  act(() => result.current.reset());
  expect(result.current.filters.model).toBe('Both');
  expect(result.current.filters.chartType).toBe('box');
});
```

- [ ] **Step 6: Run + verify the harness**

Run: `npm test -w @cf-wavescan/frontend`
Expected: 1 file, 2 tests pass, output pristine. Then `npm run build -w @cf-wavescan/frontend` still succeeds and `cd frontend && npx tsc --noEmit` exits 0 (the `test` block must not break the prod build/typecheck).

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json package-lock.json frontend/vite.config.ts frontend/src/test/setup.ts frontend/src/hooks/useFilters.test.ts
git commit -m "test(frontend): Vitest + Testing Library harness + useFilters tests"
```

---

### Task 2: ReadingsGrid interaction tests

**Files:** Create `frontend/src/components/data/ReadingsGrid.test.tsx`.

**Interfaces:** Consumes the Task-1 harness/polyfills. Mocks `../../lib/api`, `sonner`, `../../lib/shared`.

- [ ] **Step 1: Write `frontend/src/components/data/ReadingsGrid.test.tsx`**

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ReadingsGrid from './ReadingsGrid';
import { api } from '../../lib/api';
import { toast } from 'sonner';

vi.mock('../../lib/api', () => ({
  api: { readings: vi.fn(), updateReading: vi.fn(), deleteReading: vi.fn() },
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock('../../lib/shared', () => ({
  CFCore: {
    COLOR_FAMILY: { 'shadow black': 'Blacks', 'arctic white': 'Light Solids' },
    PLANTS: ['FTM', 'AAT', 'FVL', 'SAP'],
    fmtCF: (n: number) => String(n),
    modelLabel: (m: string) => (m === 'Ranger' ? 'DBL' : m),
  },
  CFLogic: { keyToLabel: (k: string) => k },
}));

const baseRows = [
  { id: 1, file_id: 1, month_key: '2026-05', plant: 'FTM', model: 'Ranger', color: 'Shadow Black', family: 'Blacks', zone: '01 RRHOOD', orient: 'H', cf: 20 },
  { id: 2, file_id: 1, month_key: '2026-05', plant: 'FTM', model: 'Ranger', color: 'Shadow Black', family: 'Blacks', zone: '02 ROOF', orient: 'H', cf: 18 },
];

function renderGrid(extra: Record<string, unknown> = {}) {
  const reload = vi.fn().mockResolvedValue(undefined);
  render(<ReadingsGrid history={{} as any} monthKey="2026-05" reload={reload} {...extra} />);
  return { reload };
}

beforeEach(() => {
  (api.readings as any).mockResolvedValue(structuredClone(baseRows));
});

test('editing CF commits via api.updateReading and updates the row', async () => {
  const user = userEvent.setup();
  (api.updateReading as any).mockResolvedValue({ ...baseRows[0], cf: 12.3 });
  const { reload } = renderGrid();
  await user.click(await screen.findByRole('button', { name: '20' }));
  const input = screen.getByRole('spinbutton');
  await user.clear(input);
  await user.type(input, '12.3');
  await user.keyboard('{Enter}');
  expect(api.updateReading).toHaveBeenCalledWith(1, { cf: 12.3 });
  expect(await screen.findByRole('button', { name: '12.3' })).toBeInTheDocument();
  expect(reload).toHaveBeenCalled();
});

test('a rejected CF edit keeps the cell in edit and toasts an error', async () => {
  const user = userEvent.setup();
  (api.updateReading as any).mockRejectedValue(new Error('HTTP 400 — bad'));
  renderGrid();
  await user.click(await screen.findByRole('button', { name: '20' }));
  await user.clear(screen.getByRole('spinbutton'));
  await user.type(screen.getByRole('spinbutton'), '15');
  await user.keyboard('{Enter}');
  expect(api.updateReading).toHaveBeenCalledWith(1, { cf: 15 });
  expect(toast.error).toHaveBeenCalled();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument(); // still editing
});

test('a client-invalid CF is rejected without an API call and stays in edit', async () => {
  const user = userEvent.setup();
  renderGrid();
  await user.click(await screen.findByRole('button', { name: '20' }));
  await user.clear(screen.getByRole('spinbutton'));
  await user.type(screen.getByRole('spinbutton'), '999');
  await user.keyboard('{Enter}');
  expect(api.updateReading).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalled();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
});

test('Escape cancels the edit without calling the API', async () => {
  const user = userEvent.setup();
  renderGrid();
  await user.click(await screen.findByRole('button', { name: '20' }));
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(api.updateReading).not.toHaveBeenCalled();
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: '20' })).toBeInTheDocument();
});

test('changing the color cell commits the new color', async () => {
  const user = userEvent.setup();
  (api.updateReading as any).mockResolvedValue({ ...baseRows[0], color: 'Arctic White', family: 'Light Solids' });
  renderGrid();
  const colorCells = await screen.findAllByRole('button', { name: 'Shadow Black' });
  await user.click(colorCells[0]);
  await user.selectOptions(screen.getByRole('combobox'), 'Arctic White');
  expect(api.updateReading).toHaveBeenCalledWith(1, { color: 'Arctic White' });
});

test('deleting a row calls api.deleteReading after confirm', async () => {
  const user = userEvent.setup();
  (api.deleteReading as any).mockResolvedValue({ ok: true, deleted: 1, fileId: 1 });
  const { reload } = renderGrid();
  const row = (await screen.findByText('02 ROOF')).closest('tr')!;
  const rowButtons = within(row).getAllByRole('button');
  await user.click(rowButtons[rowButtons.length - 1]); // trash (last button in the row)
  await user.click(await screen.findByRole('button', { name: /^delete$/i })); // AlertDialog confirm
  expect(api.deleteReading).toHaveBeenCalledWith(2);
  expect(reload).toHaveBeenCalled();
});

test('the filter box narrows visible rows by zone/color', async () => {
  const user = userEvent.setup();
  renderGrid();
  await screen.findByText('01 RRHOOD');
  await user.type(screen.getByPlaceholderText(/filter color/i), 'ROOF');
  expect(screen.queryByText('01 RRHOOD')).not.toBeInTheDocument();
  expect(screen.getByText('02 ROOF')).toBeInTheDocument();
});

test('initialFilter pre-filters on mount and re-syncs when it changes', async () => {
  const reload = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <ReadingsGrid history={{} as any} monthKey="2026-05" reload={reload} initialFilter="RRHOOD" />
  );
  expect(await screen.findByText('01 RRHOOD')).toBeInTheDocument();
  expect(screen.queryByText('02 ROOF')).not.toBeInTheDocument();
  rerender(<ReadingsGrid history={{} as any} monthKey="2026-05" reload={reload} initialFilter="ROOF" />);
  expect(await screen.findByText('02 ROOF')).toBeInTheDocument();
  expect(screen.queryByText('01 RRHOOD')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run + verify**

Run: `npm test -w @cf-wavescan/frontend`
Expected: ReadingsGrid's 8 tests pass (plus Task 1's). If a Radix AlertDialog interaction fails on a missing jsdom API, confirm the Task-1 polyfills are present (that is the fix — do not weaken the assertion).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/data/ReadingsGrid.test.tsx
git commit -m "test(frontend): ReadingsGrid edit/reject/cancel/delete/filter coverage"
```

---

### Task 3: ProblemZones + AppTopbar tests

**Files:** Create `frontend/src/components/ProblemZones.test.tsx`, `frontend/src/components/shell/AppTopbar.test.tsx`.

- [ ] **Step 1: Write `frontend/src/components/ProblemZones.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ProblemZones from './ProblemZones';
import { CFLogic } from '../lib/shared';

vi.mock('../lib/shared', () => ({
  CFCore: { modelLabel: (m: string) => m, fmtCF: (n: number) => String(n) },
  CFLogic: { problemZones: vi.fn(), fmtDelta: (d: number) => String(d) },
}));
vi.mock('../lib/select', () => ({ currentRecords: () => [] }));

const PB = {
  total: 2,
  list: [
    { status: 'FAIL', color: 'Shadow Black', zone: '01 RRHOOD', orient: 'H', model: 'Ranger', plant: 'FTM', cf: 10, devFord: -5, devMin: -2 },
    { status: 'WARNING', color: 'Code Orange', zone: '02 ROOF', orient: 'V', model: 'Raptor', plant: 'AAT', cf: 14, devFord: -1, devMin: 0 },
  ],
};

beforeEach(() => {
  (CFLogic.problemZones as any).mockReturnValue(PB);
});

const props = { history: { standards: {} } as any, filters: { orient: 'Both' } as any };

test('a row click calls onPick with that row color', async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  render(<ProblemZones {...props} onPick={onPick} />);
  await user.click(screen.getByText('01 RRHOOD'));
  expect(onPick).toHaveBeenCalledWith('Shadow Black');
});

test('without onPick the rows are not clickable', () => {
  render(<ProblemZones {...props} />);
  const row = screen.getByText('01 RRHOOD').closest('tr')!;
  expect(row.className).not.toMatch(/cursor-pointer/);
});
```

- [ ] **Step 2: Write `frontend/src/components/shell/AppTopbar.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AppTopbar from './AppTopbar';
import { SidebarProvider } from '@/components/ui/sidebar';

const base = {
  months: [] as any[],
  monthKey: null,
  onMonthChange: vi.fn(),
  files: [] as string[],
  fileSel: null,
  onFileChange: vi.fn(),
  fileSelDisabled: true,
  fileSelLabel: 'All files',
  version: '9.9.9',
  onImport: vi.fn(),
  onStandards: vi.fn(),
  hasData: false,
  view: 'dashboard' as const,
  onViewChange: vi.fn(),
};

function renderTopbar(extra: Record<string, unknown> = {}) {
  render(
    <SidebarProvider>
      <AppTopbar {...base} {...extra} />
    </SidebarProvider>
  );
}

test('Import and Standards buttons fire their handlers', async () => {
  const user = userEvent.setup();
  const onImport = vi.fn();
  const onStandards = vi.fn();
  renderTopbar({ onImport, onStandards });
  await user.click(screen.getByRole('button', { name: /import data/i }));
  await user.click(screen.getByRole('button', { name: /standards/i }));
  expect(onImport).toHaveBeenCalled();
  expect(onStandards).toHaveBeenCalled();
});

test('the view switch reports a change to data', async () => {
  const user = userEvent.setup();
  const onViewChange = vi.fn();
  renderTopbar({ onViewChange });
  await user.click(screen.getByRole('button', { name: /^data$/i }));
  expect(onViewChange).toHaveBeenCalledWith('data');
});

test('shows the version label', () => {
  renderTopbar();
  expect(screen.getByText('v9.9.9')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run + verify** — `npm test -w @cf-wavescan/frontend` → ProblemZones (2) + AppTopbar (3) pass with everything prior.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProblemZones.test.tsx frontend/src/components/shell/AppTopbar.test.tsx
git commit -m "test(frontend): ProblemZones onPick + AppTopbar handler coverage"
```

---

### Task 4: Full verification

- [ ] **Step 1: Frontend tests** — `npm test -w @cf-wavescan/frontend` → all files pass, output pristine (no act() warnings or unhandled-rejection noise; if a warning appears, wrap the offending interaction in `await` / fix the test, don't silence it).
- [ ] **Step 2: Untouched suites** — `npm test -w @cf-wavescan/shared` (15) and `npm test -w @cf-wavescan/backend` (22) still pass.
- [ ] **Step 3: Prod build/typecheck intact** — `npm run build -w @cf-wavescan/frontend` succeeds; `cd frontend && npx tsc --noEmit` exit 0.
- [ ] **Step 4:** No commit needed if Tasks 1–3 are committed and Step 1–3 reveal nothing; otherwise commit any fixes with `test(frontend): …`. No version bump (dev-only change).

---

## Self-Review

**Spec coverage:** harness + config + jsdom polyfills (T1 S1–S3); `npm test` script (T1 S4); useFilters update/reset (T1 S5); ReadingsGrid edit-success/reject/invalid/Esc/color/delete/filter/initialFilter (T2 — all 8 spec bullets); ProblemZones onPick + inert (T3 S1); AppTopbar handlers + view switch (T3 S2 — Radix-Select sentinel intentionally not opened, per spec's jsdom fallback); mock boundary api+sonner+shared (T2/T3); verify incl. untouched suites + clean prod build (T4). All spec sections mapped; no production code changed.

**Placeholder scan:** every test file is complete code; commands have expected outputs; the Radix-failure note points to the real fix (the Task-1 polyfills), not a hand-wave.

**Type consistency:** mocked `api` exposes exactly `readings`/`updateReading`/`deleteReading` (the members the components call); the shared mock exposes exactly the used members (`CFCore.COLOR_FAMILY/PLANTS/fmtCF/modelLabel`, `CFLogic.keyToLabel`, plus `problemZones`/`fmtDelta` for ProblemZones); `AppTopbar` props mirror its real `Props` interface (incl. `view`/`onViewChange` added in the click-to-edit slice); `ReadingsGrid` props are `{ history, monthKey, reload, initialFilter? }` as implemented.
