import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import StatStrip from './StatStrip';

vi.mock('../lib/shared', () => ({ CFCore: { zoneStatuses: vi.fn() } }));
vi.mock('../lib/select', () => ({ currentRecords: vi.fn() }));
import { CFCore } from '../lib/shared';
import { currentRecords } from '../lib/select';

beforeEach(() => {
  (currentRecords as any).mockReturnValue([]);
  (CFCore.zoneStatuses as any).mockReturnValue([
    { status: 'PASS', orient: 'H' },
    { status: 'PASS', orient: 'H' },
    { status: 'WARNING', orient: 'H' },
    { status: 'FAIL', orient: 'H' },
  ]);
});

const base = { history: { standards: {} } as any, filters: { orient: 'Both' } as any };

test('renders three tiles with zone-level counts', () => {
  render(<StatStrip {...base} active={null} onSelect={vi.fn()} />);
  expect(screen.getByText('Pass').previousSibling).toHaveTextContent('2');
  expect(screen.getByText('Warning').previousSibling).toHaveTextContent('1');
  expect(screen.getByText('Fail').previousSibling).toHaveTextContent('1');
  expect(screen.queryByText('Readings')).not.toBeInTheDocument();
});

test('clicking a tile calls onSelect with its status', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<StatStrip {...base} active={null} onSelect={onSelect} />);
  await user.click(screen.getByText('Fail'));
  expect(onSelect).toHaveBeenCalledWith('FAIL');
});

test('the active tile is marked pressed', () => {
  render(<StatStrip {...base} active="WARNING" onSelect={vi.fn()} />);
  const warnTile = screen.getByText('Warning').closest('button')!;
  expect(warnTile).toHaveAttribute('aria-pressed', 'true');
});
