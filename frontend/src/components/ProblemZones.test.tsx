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
