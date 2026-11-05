'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { devQuery, merchApi, parentOf, type MerchApi } from '@/lib/merch';
import {
  LINK_KEY,
  clearCart,
  dropDraft,
  readStore,
  subscribeStore,
  writeStore,
} from '@/lib/merch-cart';
import { openTelegram, useTelegram } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { CartBar, CartSheet } from './CartSheet';
import {
  Banner,
  DANGER_CLASS,
  Empty,
  SECONDARY_CLASS,
  Spinner,
  SurfaceContext,
  useToastHost,
} from './ui';

export { useSurface } from './ui';

export interface Surface {
  kind: 'web' | 'tg';
  base: '/merch' | '/merch-app';
  /** True from a mount effect, once the stores hold client values; markup must not branch on them before. */
  ready: boolean;
  /** Init data or dev identity in Telegram; a stored token on the web. */
  signedIn: boolean;
  isAdmin: boolean;
  api: MerchApi;
  /** Telegram only; null on the web. */
  tg: ReturnType<typeof useTelegram> | null;
  /** Web only: keep the session after the bot step. */
  signIn(session: string): void;
  signOut(): void;
  share(url: string, title: string): void;
  toast(text: string): void;
  /** Telegram only: asks once per session for the right to message this person. */
  askWriteAccess(): void;
  /** The cart is a sheet over whatever page is open, so its state lives here. */
  cartOpen: boolean;
  openCart(): void;
  closeCart(): void;
}

const WEB_HOME = '/merch';
const TOKEN_KEY = 'merch-token';
const SIGN_OUT_WAIT_MS = 3_000;
const readToken = () => readStore(TOKEN_KEY);
const subscribeNothing = () => () => {};
const noop = () => {};

/** Adds no DOM node around children: main and footer stay children of body. */
export function WebSurface({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(subscribeStore, readToken, () => null);
  // Sign-out wipes the storage at once, but the screen stays signed in until the reload:
  // otherwise LinkGate flashes in that moment and opens a link nobody asked for.
  const [leaving, setLeaving] = useState<string | null>(null);
  const token = stored ?? leaving;
  // Flips in the same commit as the stores leave their server snapshots.
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const { toast, toastHost } = useToastHost('web');
  const [cartOpen, setCartOpen] = useState(false);
  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  // A 401 clears the token only, because the draft may hold a paid receipt.
  const api = useMemo(
    () => merchApi(token ? { 'x-merch-token': token } : {}, () => writeStore(TOKEN_KEY, null)),
    [token],
  );

  const share = useCallback(
    (url: string, title: string) => {
      if (navigator.share) {
        navigator.share({ title, url }).catch(noop); // closing the sheet rejects
        return;
      }
      Promise.resolve()
        .then(() => navigator.clipboard.writeText(url))
        .then(
          () => toast('Посилання скопійовано'),
          () => toast(url),
        );
    },
    [toast],
  );

  const surface = useMemo<Surface>(
    () => ({
      kind: 'web',
      base: '/merch',
      ready,
      signedIn: !!token,
      isAdmin: false,
      api,
      tg: null,
      signIn: (session) => writeStore(TOKEN_KEY, session),
      signOut: () => {
        setLeaving(token);
        // The request carries the token, so it starts first; the wipe does not wait for the network.
        const ended = api.endLink().catch(noop);
        writeStore(TOKEN_KEY, null);
        writeStore(LINK_KEY, null);
        dropDraft();
        clearCart();
        // Capped: on a dead network the person would otherwise stare at a screen that did nothing.
        const capped = new Promise((done) => setTimeout(done, SIGN_OUT_WAIT_MS));
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, so a shared computer keeps no restricted title in the module catalog either
        void Promise.race([ended, capped]).then(() => location.assign(WEB_HOME));
      },
      share,
      toast,
      askWriteAccess: noop,
      cartOpen,
      openCart,
      closeCart,
    }),
    [api, cartOpen, closeCart, openCart, ready, share, toast, token],
  );

  return (
    <SurfaceContext.Provider value={surface}>
      {children}
      <CartBar />
      <CartSheet />
      {toastHost}
    </SurfaceContext.Provider>
  );
}

let writeAccessAsked = false;

function askWriteAccess() {
  if (writeAccessAsked) return;
  writeAccessAsked = true;
  const w = window.Telegram?.WebApp;
  try {
    if (w?.initDataUnsafe.user?.allows_write_to_pm === false) w.requestWriteAccess?.();
  } catch {
    // Clients older than 6.9 throw here. A refusal does not block: a later 403 marks the card.
  }
}

/** Only the surface knows about Telegram: one useTelegram call, the hook has per-call state. */
export function TelegramSurface({ children }: { children: ReactNode }) {
  const tg = useTelegram();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stale, setStale] = useState(false);
  const { toast, toastHost } = useToastHost('tg');
  const [cartOpen, setCartOpen] = useState(false);
  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const api = useMemo(
    () => merchApi({ 'x-telegram-init-data': tg.initData }, () => setStale(true)),
    [tg.initData],
  );

  const signedIn = tg.ready && (!!tg.initData || !!devQuery());
  const outside = tg.ready && !tg.isTelegram && !devQuery();
  const adminPath = pathname.startsWith('/merch-app/admin');

  // Decides only whether the Адмін tab appears, so it uses a client without the stale banner.
  useEffect(() => {
    if (!signedIn) return;
    merchApi({ 'x-telegram-init-data': tg.initData })
      .admin.check()
      .then(() => setIsAdmin(true), noop);
  }, [signedIn, tg.initData]);

  useEffect(() => {
    if (outside && !adminPath) {
      location.replace(`/merch${pathname.slice('/merch-app'.length)}${location.search}`);
    }
  }, [outside, adminPath, pathname]);

  // The only BackButton caller, because Telegram has one global handler. An open cart takes it first.
  useEffect(() => {
    const parent = parentOf(pathname, '/merch-app');
    if (cartOpen) tg.showBackButton(closeCart);
    else if (parent) tg.showBackButton(() => router.push(parent));
    else tg.hideBackButton();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tg is a new object on every render
  }, [pathname, cartOpen]);

  const surface: Surface = {
    kind: 'tg',
    base: '/merch-app',
    ready: tg.ready,
    signedIn,
    isAdmin,
    api,
    tg,
    signIn: noop,
    signOut: noop,
    share: (url, title) =>
      openTelegram(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      ),
    toast,
    askWriteAccess,
    cartOpen,
    openCart,
    closeCart,
  };

  return (
    <SurfaceContext.Provider value={surface}>
      {!outside ? (
        <>
          {children}
          <CartBar />
          <CartSheet />
        </>
      ) : adminPath ? (
        <OpenInTelegram />
      ) : (
        <Spinner />
      )}
      {stale && (
        <div className="fixed left-1/2 top-3 z-50 w-full max-w-md -translate-x-1/2 px-3">
          <div className="rounded-xl bg-bg shadow-2xl shadow-black/60">
            <Banner tone="error">
              <div className="flex items-center justify-between gap-3">
                <span>Сесія застаріла. Закрийте і відкрийте застосунок знову.</span>
                <button
                  type="button"
                  onClick={tg.close}
                  className={cn(DANGER_CLASS, 'shrink-0 px-3')}
                >
                  Закрити
                </button>
              </div>
            </Banner>
          </div>
        </div>
      )}
      {toastHost}
    </SurfaceContext.Provider>
  );
}

/** Admin screens have nothing on the public tree to fall back to. */
function OpenInTelegram() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Image
        src="/logo_white.png"
        alt="Студрада ФІОТ"
        width={160}
        height={55}
        priority
        className="h-12 w-auto object-contain"
      />
      <Empty
        icon="✈️"
        title="Відкрийте через Telegram"
        text="Mini App працює лише при запуску з кнопки в Telegram-боті."
        action={
          // Another tree: a soft navigation would skip its beforeInteractive scripts.
          <a href={WEB_HOME} className={SECONDARY_CLASS}>
            До каталогу
          </a>
        }
      />
    </div>
  );
}
