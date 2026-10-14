'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { USER_BOT_USERNAME } from '@/lib/bot';
import {
  COUNCIL_EMAIL,
  errorText,
  loginString,
  saveLogin,
  savedLogin,
  staffApi,
  type StaffMe,
} from '@/lib/shari';
import { AdminPanel } from './AdminPanel';
import { GroupPanel } from './GroupPanel';
import { Banner, ErrorText, Panel, Spinner } from './ui';

type WidgetUser = Record<string, string | number>;

/** `?tgUserId=&tgTag=`: the dev identity the API accepts only with AUTH_DISABLED. */
function devQuery(): string {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('tgUserId');
  if (!id) return '';
  const tag = params.get('tgTag') ?? '';
  return `?tgUserId=${encodeURIComponent(id)}&tgTag=${encodeURIComponent(tag)}`;
}

const noSubscribe = () => () => {};

export function StaffApp() {
  // Read from the browser after hydration (null on the server render).
  const stored = useSyncExternalStore(noSubscribe, savedLogin, () => null);
  const dev = useSyncExternalStore(noSubscribe, devQuery, () => '');
  const [changed, setChanged] = useState<string | null>(null);
  const [me, setMe] = useState<StaffMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const login = changed ?? stored;

  const api = useMemo(() => staffApi(login ?? '', dev), [login, dev]);
  const signedIn = !!login || !!dev;

  useEffect(() => {
    if (!signedIn) return;
    api.me().then(setMe, (err) => {
      if (err instanceof ApiError && err.status === 401) {
        saveLogin('');
        setChanged('');
      }
      setError(errorText(err));
    });
  }, [api, signedIn]);

  const onAuth = useCallback((user: WidgetUser) => {
    const value = loginString(user);
    saveLogin(value);
    setError(null);
    setChanged(value);
  }, []);

  const logout = () => {
    saveLogin('');
    setChanged('');
    setMe(null);
    setError(null);
  };

  if (login === null) return <Spinner />;
  if (!signedIn) return <SignIn onAuth={onAuth} error={error} />;
  if (!me) return error ? <Banner tone="warn">{error}</Banner> : <Spinner />;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-subtle">
        <span>
          Акаунт: <b className="text-fg">{me.user.name}</b>
          {me.user.username && ` (@${me.user.username})`}
          {me.isAdmin && ' · президія'}
          {me.group && ` · староста ${me.group}`}
        </span>
        <Button variant="ghost" onClick={logout}>
          Вийти
        </Button>
      </div>
      {me.isAdmin ? (
        <AdminPanel api={api} me={me} />
      ) : me.group ? (
        <GroupPanel api={api} group={me.group} />
      ) : (
        <Banner tone="warn">
          Тебе немає у списку старост. Перевір, що в Telegram у тебе той самий
          @тег, що й у списку, або напиши нам:{' '}
          <a href={`mailto:${COUNCIL_EMAIL}`} className="font-semibold underline">
            {COUNCIL_EMAIL}
          </a>
        </Banner>
      )}
    </>
  );
}

function SignIn({
  onAuth,
  error,
}: {
  onAuth: (user: WidgetUser) => void;
  error: string | null;
}) {
  return (
    <Panel title="Вхід">
      <p className="text-muted">
        Увійди через Telegram — тим акаунтом, @тег якого є у списку старост.
        Telegram запитає, чи дозволити боту Студради писати тобі, — дозволь,
        щоб ми могли звʼязатися щодо шар.
      </p>
      <div className="mt-5">
        <TelegramLogin onAuth={onAuth} />
      </div>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Panel>
  );
}

/** Telegram Login Widget of the user bot (its domain must be set in @BotFather → /setdomain). */
function TelegramLogin({ onAuth }: { onAuth: (user: WidgetUser) => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !USER_BOT_USERNAME) return;
    (window as unknown as Record<string, unknown>).onShariTelegramAuth = onAuth;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.dataset.telegramLogin = USER_BOT_USERNAME;
    script.dataset.size = 'large';
    script.dataset.radius = '12';
    script.dataset.userpic = 'false';
    script.dataset.requestAccess = 'write';
    script.dataset.onauth = 'onShariTelegramAuth(user)';
    el.appendChild(script);
    return () => el.replaceChildren();
  }, [onAuth]);

  if (!USER_BOT_USERNAME) {
    return (
      <ErrorText>
        Вхід не налаштовано: немає імені бота (NEXT_PUBLIC_USER_BOT_USERNAME).
      </ErrorText>
    );
  }
  return <div ref={box} className="min-h-10" />;
}
