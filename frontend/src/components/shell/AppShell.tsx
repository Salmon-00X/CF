/* =========================================================================
 * AppShell — layout frame only (no app logic, no auth). Wraps the shadcn
 * sidebar primitive: a collapsible filter rail on the left, a sticky topbar,
 * and the scrollable main content area. Built by hand (the paid @efferd
 * template was dropped — see docs/superpowers/notes/registry-decision.md).
 * ========================================================================= */
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';

interface Props {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ sidebar, topbar, children }: Props) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">{sidebar}</Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-primary/30 bg-gradient-to-r from-primary to-[hsl(211_59%_22%)] px-4 text-primary-foreground">
          {topbar}
        </header>
        <main className="flex flex-1 flex-col gap-3 p-3 md:p-5">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
