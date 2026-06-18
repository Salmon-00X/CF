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
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
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
