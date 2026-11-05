'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { DELIVERY_LABEL, isValidUaPhone, priceText } from '@/lib/merch';
import type { OrderRow } from '@/lib/merch-types';
import { cn, plural } from '@/lib/utils';
import { DefaultBadge, LinkGate, RecipientFields } from './LinkGate';
import { useSurface } from './surface';
import {
  ACTION_CLASS,
  Banner,
  CONTROL,
  PANEL_CLASS,
  SECONDARY_CLASS,
  StatusPill,
  errorText,
  useAction,
} from './ui';

const DATE = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Kyiv',
});

const HEADING = 'text-base font-black uppercase tracking-wider text-muted';

/** Each list of the screen loads, fails and retries on its own. */
function useList<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    load().then(
      (next) => {
        if (!live) return;
        setData(next);
        setError(null);
      },
      (err: unknown) => {
        if (live) setError(errorText(err));
      },
    );
    return () => {
      live = false;
    };
  }, [attempt, load]);

  return { data, error, reload: () => setAttempt((n) => n + 1) };
}

// ---- Orders tab ---------------------------------------------------------------

export function OrdersScreen() {
  return (
    <LinkGate>
      <Orders />
    </LinkGate>
  );
}

function Orders() {
  const { api, base } = useSurface();
  const orders = useList(useCallback(() => api.orders(), [api]));
  const list = orders.data?.orders;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className={HEADING}>Мої замовлення</h2>
        {!!list?.length && (
          <span className="text-sm font-bold text-brand-cyan">
            {plural(list.length, ['замовлення', 'замовлення', 'замовлень'])}
          </span>
        )}
      </div>
      {orders.error && !list ? (
        <ListFailure text={orders.error} onRetry={orders.reload} />
      ) : !list ? (
        <Skeleton height="h-44" />
      ) : list.length ? (
        list.map((order) => <OrderCard key={order.id} order={order} />)
      ) : (
        <div className="space-y-3 rounded-3xl border border-dashed border-border p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-surface text-muted">
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </span>
          <p className="text-sm font-bold text-fg">Ви ще не робили замовлень</p>
          <p className="text-xs text-muted">Перегляньте каталог і оберіть щось для себе!</p>
          <Link
            href={base}
            className={cn(
              'mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-main px-4 py-2.5 text-xs font-bold text-black',
              CONTROL,
            )}
          >
            Відкрити каталог
          </Link>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const { base } = useSurface();
  const ready = order.status === 'READY_FOR_PICKUP';
  const delivery =
    order.deliveryMethod === 'NOVA_POSHTA'
      ? `Нова Пошта — ${order.address}`
      : order.deliveryMethod
        ? DELIVERY_LABEL[order.deliveryMethod]
        : order.address;

  return (
    <article className="space-y-3.5 rounded-3xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan">
            Замовлення #{order.id}
          </span>
          <h3 className="mt-0.5 text-lg font-black tabular-nums leading-snug">
            {priceText(order.totalAmount)} грн
          </h3>
          <p className="text-xs text-muted">{DATE.format(new Date(order.createdAt))}</p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="space-y-1 rounded-2xl border border-border/60 bg-bg/40 p-3 text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">
        {order.items.map((item, i) => (
          <p key={i}>
            <span className="text-fg">{item.title}</span>
            {item.options && ` · ${item.options.replace(' — ', ' · ')}`} ×{item.quantity}
          </p>
        ))}
      </div>

      {delivery && (
        <p className="flex items-center gap-1.5 text-xs text-muted [overflow-wrap:anywhere]">
          <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {delivery}
        </p>
      )}

      {ready && order.pickupLabel && (
        <p className="text-sm font-bold text-brand-cyan">🗓 Час видачі: {order.pickupLabel}</p>
      )}
      {ready && !order.pickupLabel && order.needsIndividualPickup && (
        <p className="text-sm text-muted">{"📞 Видача індивідуально — з вами зв'яжуться"}</p>
      )}
      {order.canChoosePickup && (
        <Link
          href={`${base}/pickup/${order.id}`}
          className={cn(
            'flex w-full items-center justify-center rounded-xl bg-gradient-main py-3 text-sm font-extrabold text-black transition-transform duration-200 active:scale-[0.98]',
            CONTROL,
          )}
        >
          🗓 Обрати час видачі
        </Link>
      )}
    </article>
  );
}

// ---- Profile tab --------------------------------------------------------------

export function ProfileScreen() {
  return (
    <LinkGate>
      <Profile />
    </LinkGate>
  );
}

function Profile() {
  const { api, tg, toast } = useSurface();
  const { busy, error, run } = useAction();
  const recipients = useList(useCallback(() => api.recipients(), [api]));

  const act = async (action: () => Promise<unknown>, done?: string) => {
    if (!(await run(action))) return;
    if (done) toast(done);
    recipients.reload();
  };

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className={HEADING}>Мій профіль</h2>
        <p className="mt-1 text-sm text-muted">
          Збережені отримувачі підставлятимуться при кожному замовленні
        </p>
      </div>

      <Card title="Збережені отримувачі">
        {recipients.error && !recipients.data ? (
          <ListFailure text={recipients.error} onRetry={recipients.reload} />
        ) : !recipients.data ? (
          <Skeleton height="h-16" />
        ) : recipients.data.recipients.length ? (
          <ul className="-my-1 divide-y divide-border/60">
            {recipients.data.recipients.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{r.fullName}</p>
                  <p className="text-sm text-subtle">{r.phone}</p>
                </div>
                {r.isDefault ? (
                  <DefaultBadge />
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(() => api.defaultRecipient(r.id))}
                    className={cn(SECONDARY_CLASS, 'shrink-0 px-3')}
                  >
                    Обрати
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Видалити"
                  onClick={() => void act(() => api.deleteRecipient(r.id), 'Видалено')}
                  className={cn(
                    'flex size-[40px] shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-brand-red/10 hover:text-brand-red disabled:opacity-50',
                    CONTROL,
                  )}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-subtle">Немає збережених отримувачів</p>
        )}
        {error && <Banner tone="error">{error}</Banner>}
      </Card>

      <Card title="Додати отримувача">
        <AddRecipient onAdded={recipients.reload} />
      </Card>

      <Card title="Потрібна допомога?">
        <p className="text-sm leading-relaxed text-muted">
          Не виходить оформити, завантажити квитанцію чи знайти замовлення? Напишіть у чаті з ботом:
          кнопка «💬 Підтримка» або команда /support.
        </p>
        <button type="button" onClick={tg?.close} className={cn(SECONDARY_CLASS, 'w-full rounded-full')}>
          Перейти в чат
        </button>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn(PANEL_CLASS, 'space-y-3.5')}>
      <h3 className="text-base font-black">{title}</h3>
      {children}
    </section>
  );
}

function AddRecipient({ onAdded }: { onAdded(): void }) {
  const { api, toast } = useSurface();
  const { busy, error, run } = useAction();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const ready = !!name.trim() && isValidUaPhone(phone);

  const add = async () => {
    const ok = await run(() => api.addRecipient({ fullName: name.trim(), phone: phone.trim() }));
    if (!ok) return;
    setName('');
    setPhone('');
    toast('Отримувача додано');
    onAdded();
  };

  return (
    <>
      <RecipientFields name={name} phone={phone} onName={setName} onPhone={setPhone} />
      {error && <Banner tone="error">{error}</Banner>}
      <Button className={ACTION_CLASS} disabled={busy || !ready} onClick={add}>
        {busy ? 'Зберігаємо...' : 'Додати'}
      </Button>
    </>
  );
}

function ListFailure({ text, onRetry }: { text: string; onRetry(): void }) {
  return (
    <div className="space-y-2">
      <Banner tone="error">{text}</Banner>
      <button type="button" onClick={onRetry} className={cn(SECONDARY_CLASS, 'w-full')}>
        Спробувати ще раз
      </button>
    </div>
  );
}

function Skeleton({ height }: { height: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-3xl bg-surface', height)} />;
}
