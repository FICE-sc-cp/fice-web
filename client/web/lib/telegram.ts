'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
          start_param?: string;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        };
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        showScanQrPopup?: (
          params: { text?: string },
          callback?: (text: string) => boolean | void,
        ) => void;
        closeScanQrPopup?: () => void;
      };
    };
  }
}

export interface TelegramUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
}

let activeBackHandler: (() => void) | null = null;

export function useTelegram() {
  const [ready, setReady] = useState(false);
  const [initData, setInitData] = useState<string>('');
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tg = window.Telegram?.WebApp;
    if (tg && (tg.initData || tg.initDataUnsafe?.user)) {
      try {
        tg.ready();
        tg.expand();
        (tg as any).disableVerticalSwipes?.();
        (tg as any).setHeaderColor?.('#101010');
        (tg as any).setBackgroundColor?.('#101010');
      } catch {}

      setIsTelegram(true);
      setInitData(tg.initData || '');
      if (tg.initDataUnsafe?.user) {
        setUser({
          id: tg.initDataUnsafe.user.id,
          firstName: tg.initDataUnsafe.user.first_name,
          lastName: tg.initDataUnsafe.user.last_name,
          username: tg.initDataUnsafe.user.username,
        });
      }

      // Check start_param from Telegram WebApp or URL search params
      const param =
        tg.initDataUnsafe?.start_param ||
        new URLSearchParams(window.location.search).get('startapp') ||
        new URLSearchParams(window.location.search).get('tgWebAppStartParam');
      if (param) {
        setStartParam(param);
      }
    } else {
      // Local development or web preview fallback
      const urlParams = new URLSearchParams(window.location.search);
      const devUserId = urlParams.get('tgUserId');
      const startapp = urlParams.get('startapp');

      if (devUserId) {
        setUser({
          id: Number(devUserId),
          firstName: 'Тестовий',
          lastName: 'Користувач',
          username: 'testuser',
        });
      }
      if (startapp) {
        setStartParam(startapp);
      }
    }

    setReady(true);
  }, []);

  const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
    } catch {}
  };

  const hapticNotify = (type: 'success' | 'warning' | 'error') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
    } catch {}
  };

  const showBackButton = (cb: () => void) => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.BackButton) {
        if (activeBackHandler) tg.BackButton.offClick(activeBackHandler);
        activeBackHandler = cb;
        tg.BackButton.onClick(cb);
        tg.BackButton.show();
      }
    } catch {}
  };

  const hideBackButton = () => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.BackButton) {
        if (activeBackHandler) tg.BackButton.offClick(activeBackHandler);
        activeBackHandler = null;
        tg.BackButton.hide();
      }
    } catch {}
  };

  const scanQr = (
    text: string,
    onScan: (scannedText: string) => boolean | void,
  ) => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.showScanQrPopup) {
        tg.showScanQrPopup({ text }, onScan);
      } else {
        const manual = window.prompt(
          'Сканер доступний у додатку Telegram на телефоні.\nВведіть код квитка або ID учасника вручну:',
        );
        if (manual) onScan(manual.trim());
      }
    } catch (e) {
      console.error('Scan QR error:', e);
    }
  };

  const closeQrScanner = () => {
    try {
      window.Telegram?.WebApp?.closeScanQrPopup?.();
    } catch {}
  };

  return {
    ready,
    isTelegram,
    initData,
    user,
    startParam,
    haptic,
    hapticNotify,
    showBackButton,
    hideBackButton,
    scanQr,
    closeQrScanner,
    close: () => window.Telegram?.WebApp?.close(),
  };
}
