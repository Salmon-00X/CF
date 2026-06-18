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
