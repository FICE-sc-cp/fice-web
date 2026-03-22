'use client';
import { createContext, useEffect, useState } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TelegramContext {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  initData: string;
}

export const TelegramCtx = createContext<TelegramContext>({
  webApp: null,
  user: null,
  initData: '',
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState('');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    tg.expand();
    setWebApp(tg);
    setInitData(tg.initData);

    if (tg.initDataUnsafe?.user) {
      setUser(tg.initDataUnsafe.user);
    }
  }, []);

  return (
    <TelegramCtx.Provider value={{ webApp, user, initData }}>
      {children}
    </TelegramCtx.Provider>
  );
}
