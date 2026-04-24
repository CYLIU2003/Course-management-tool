import type { ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return <div className="app-shell tcu-tt">{children}</div>;
}