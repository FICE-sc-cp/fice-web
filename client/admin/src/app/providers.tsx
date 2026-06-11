'use client';

import { TelegramProvider } from '@/lib/telegram';
import { QueryProvider } from '@/lib/query';
import { AuthGate } from '@/components/AuthGate';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TelegramProvider>
      <QueryProvider>
        <AuthGate>{children}</AuthGate>
      </QueryProvider>
    </TelegramProvider>
  );
}
