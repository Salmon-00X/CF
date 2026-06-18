import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ActionItems from './ActionItems';

vi.mock('../lib/shared', () => ({ CFLogic: { problemZones: vi.fn(), fmtDelta: (d: number) => String(d) } }));
vi.mock('../lib/select', () => ({ currentRecords: () => [] }));
import { CFLogic } from '../lib/shared';

beforeEach(() => {
  (CFLogic.problemZones as any).mockReturnValue({
    total: 2,
    list: [
      { status: 'FAIL', color: 'Shadow Black', zone: '01 RRHOOD', orient: 'H', devMin: -5 },
      { status: 'WARNING', color: 'Code Orange', zone: '02 ROOF', orient: 'V', devMin: -1 },
    ],
  });
});

const props = { history: { standards: {} } as any, filters: { orient: 'Both' } as any };

test('clicking an item calls onPick with its color', async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  render(<ActionItems {...props} onPick={onPick} />);
  await user.click(screen.getByText('Shadow Black'));
  expect(onPick).toHaveBeenCalledWith('Shadow Black');
});

test('shows the all-clear state when there are no problem zones', () => {
  (CFLogic.problemZones as any).mockReturnValue({ total: 0, list: [] });
  render(<ActionItems {...props} />);
  expect(screen.getByText(/every checkzone meets/i)).toBeInTheDocument();
});
