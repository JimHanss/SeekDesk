import type { ReactNode } from "react";

export function DailyWorkModuleStack({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full w-full flex-col gap-4">{children}</div>;
}
