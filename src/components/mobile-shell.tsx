import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24 shadow-card">
        {children}
      </div>
    </div>
  );
}