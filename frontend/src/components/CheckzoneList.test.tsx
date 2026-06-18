import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CheckzoneList from './CheckzoneList';

vi.mock('../lib/shared', () => ({
  CFCore: { zoneStatuses: vi.fn() },
  CFLogic: { problemZones: vi.fn(), fmtDelta: (d: number) => String(d) },
}));
vi.mock('../lib/select', () => ({ currentRecords: () => [] }));
import { CFCore, CFLogic } from '../lib/shared';

const base = { history: { standards: {} } as any, filters: { orient: 'Both' } as any };

test('default shows worst problem-zone rows', () => {
  (CFLogic.problemZones as any).mockReturnValue({
    total: 1,
    list: [{ status: 'FAIL', color: 'Shadow Black', zone: '01 RRHOOD', orient: 'H', devMin: -5 }],
  });
  render(<CheckzoneList {...base} />);
  expect(screen.getByText('Action items — fix first')).toBeInTheDocument();
  expect(screen.getByText('Shadow Black')).toBeInTheDocument();
});

test('with a statusFilter shows that status’s checkzones and titles the count', async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  (CFCore.zoneStatuses as any).mockReturnValue([
    { status: 'FAIL', color: 'Shadow Black', zone: '01 RRHOOD', orient: 'H', devMin: -5 },
    { status: 'PASS', color: 'Arctic White', zone: '02 ROOF', orient: 'H', devMin: 4 },
  ]);
  render(<CheckzoneList {...base} statusFilter="FAIL" onPick={onPick} />);
  expect(screen.getByText('Fail checkzones (1)')).toBeInTheDocument();
  expect(screen.queryByText('Arctic White')).not.toBeInTheDocument();
  await user.click(screen.getByText('Shadow Black'));
  expect(onPick).toHaveBeenCalledWith('Shadow Black');
});

test('empty state for a status with no matching zones', () => {
  (CFCore.zoneStatuses as any).mockReturnValue([{ status: 'PASS', color: 'X', zone: 'z', orient: 'H', devMin: 1 }]);
  render(<CheckzoneList {...base} statusFilter="FAIL" />);
  expect(screen.getByText(/no fail checkzones/i)).toBeInTheDocument();
});
