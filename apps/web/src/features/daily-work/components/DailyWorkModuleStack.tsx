import type { ReactNode } from "react";

export function DailyWorkModuleStack({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">{children}</div>;
}