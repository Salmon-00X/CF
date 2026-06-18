import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import StatStrip from './StatStrip';

vi.mock('../lib/shared', () => ({ CFLogic: { summarize: vi.fn() } }));
vi.mock('../lib/select', () => ({ currentRecords: vi.fn() }));
import { CFLogic } from '../lib/shared';
import { currentRecords } from '../lib/select';

test('renders the four tiles with the right counts', () => {
  (currentRecords as any).mockReturnValue(new Array(50).fill({ orient: 'H' }));
  (CFLogic.summarize as any).mockReturnValue({
    byStatus: {
      PASS: [{ orient: 'H' }, { orient: 'H' }, { orient: 'H' }],
      WARNING: [{ orient: 'H' }],
      FAIL: [{ orient: 'H' }],
    },
  });
  render(<StatStrip history={{ standards: {} } as any} filters={{ orient: 'Both' } as any} />);
  expect(screen.getByText('Pass').previousSibling).toHaveTextContent('3');
  expect(screen.getByText('Warning').previousSibling).toHaveTextContent('1');
  expect(screen.getByText('Fail').previousSibling).toHaveTextContent('1');
  expect(screen.getByText('Readings').previousSibling).toHaveTextContent('50');
});
