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
    error,
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

  // /auth/me failed (e.g. 401) — the Telegram session could not be verified.
  // This is distinct from "verified, but not an admin" below.
  if (isError) {
    return (
      <FullScreen>
        <p className="text-lg font-semibold text-fg">Сесію не підтверджено</p>
        <p>
          Не вдалося перевірити Telegram-сесію. Повністю закрий і знову відкрий
          панель через кнопку бота (@fice_admin_bot).
        </p>
        <p className="text-xs text-subtle">
          Деталі: {error instanceof Error ? error.message : 'невідома помилка'}
        </p>
      </FullScreen>
    );
  }

  // Verified user, but not a member of the admin group.
  if (!me?.isAdmin) {
    return (
      <FullScreen>
        <p className="text-lg font-semibold text-fg">Немає доступу</p>
        <p>Щоб керувати контентом, потрібно бути учасником адмін-групи студради.</p>
        {me && (
          <p className="text-xs text-subtle">
            Твій Telegram ID: {me.id}
            {me.username ? ` (@${me.username})` : ''}
          </p>
        )}
      </FullScreen>
    );
  }

  return <>{children}</>;
}
