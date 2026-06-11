'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  init,
  isTMA,
  retrieveRawInitData,
  hapticFeedbackImpactOccurred,
  hapticFeedbackNotificationOccurred,
  mountBackButton,
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  mountMainButton,
  setMainButtonParams,
  onMainButtonClick,
} from '@telegram-apps/sdk';
import { setInitData } from './auth';

interface TgState {
  ready: boolean;
  isTelegram: boolean;
}

const TgCtx = createContext<TgState>({ ready: false, isTelegram: false });

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TgState>({ ready: false, isTelegram: false });

  useEffect(() => {
    let inTelegram = false;
    try {
      inTelegram = isTMA();
    } catch {
      inTelegram = false;
    }

    if (!inTelegram) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ ready: true, isTelegram: false });
      return;
    }

    try {
      init();
    } catch {}

    try {
      const raw = retrieveRawInitData();
      if (raw) setInitData(raw);
    } catch {}

    setState({ ready: true, isTelegram: true });
  }, []);

  return <TgCtx.Provider value={state}>{children}</TgCtx.Provider>;
}

export function useTelegram() {
  return useContext(TgCtx);
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    if (hapticFeedbackImpactOccurred.isAvailable()) hapticFeedbackImpactOccurred(style);
  } catch {}
}

export function hapticNotify(type: 'success' | 'warning' | 'error') {
  try {
    if (hapticFeedbackNotificationOccurred.isAvailable())
      hapticFeedbackNotificationOccurred(type);
  } catch {}
}

export function useBackButton(onBack?: () => void) {
  useEffect(() => {
    if (!onBack) return;
    let off: (() => void) | undefined;
    try {
      if (mountBackButton.isAvailable()) mountBackButton();
      if (showBackButton.isAvailable()) showBackButton();
      if (onBackButtonClick.isAvailable()) off = onBackButtonClick(onBack);
    } catch {}
    return () => {
      try {
        off?.();
        if (hideBackButton.isAvailable()) hideBackButton();
      } catch {}
    };
  }, [onBack]);
}

export function useMainButton(params: {
  text: string;
  onClick: () => void;
  enabled?: boolean;
  loading?: boolean;
  visible?: boolean;
}) {
  const { text, onClick, enabled = true, loading = false, visible = true } = params;
  const cbRef = useRef(onClick);
  useEffect(() => {
    cbRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    let off: (() => void) | undefined;
    try {
      if (mountMainButton.isAvailable()) mountMainButton();
      if (onMainButtonClick.isAvailable()) off = onMainButtonClick(() => cbRef.current());
    } catch {}
    return () => {
      try {
        off?.();
        if (setMainButtonParams.isAvailable()) setMainButtonParams({ isVisible: false });
      } catch {}
    };
  }, []);

  useEffect(() => {
    try {
      if (setMainButtonParams.isAvailable())
        setMainButtonParams({
          text,
          isVisible: visible,
          isEnabled: enabled && !loading,
          isLoaderVisible: loading,
        });
    } catch {}
  }, [text, visible, enabled, loading]);
}
