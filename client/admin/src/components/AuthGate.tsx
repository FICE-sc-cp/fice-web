'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTelegram } from '@/lib/telegram';

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-8 text-center text-muted">
      {children}
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, isTelegram } = useTelegram();

  const {
    data: me,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    enabled: ready && isTelegram,
    retry: false,
  });

  if (!ready) {
    return <FullScreen>Завантаження…</FullScreen>;
  }

  if (!isTelegram) {
    return (
      <FullScreen>
        <p className="text-lg font-semibold text-fg">Відкрий через Telegram</p>
        <p>Ця панель працює лише всередині Telegram Mini App.</p>
      </FullScreen>
    );
  }

  if (isLoading) {
    return <FullScreen>Перевірка доступу…</FullScreen>;
  }

  if (isError || !me?.isAdmin) {
    return (
      <FullScreen>
        <p className="text-lg font-semibold text-fg">Немає доступу</p>
        <p>Щоб керувати контентом, потрібно бути учасником адмін-групи студради.</p>
      </FullScreen>
    );
  }

  return <>{children}</>;
}
