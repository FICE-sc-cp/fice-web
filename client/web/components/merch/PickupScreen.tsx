'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import type { PickupInfo } from '@/lib/merch-types';
import { CheckRow, LinkGate, RadioCard } from './LinkGate';
import { useSurface } from './surface';
import {
  ACTION_CLASS,
  Banner,
  Empty,
  PageBack,
  SECONDARY_CLASS,
  Spinner,
  errorText,
  useAction,
} from './ui';

const ORDER_ID = /^[1-9]\d{0,8}$/;

export function PickupScreen({ orderId }: { orderId: string }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <PageBack label="Замовлення" />
        <h1 className="text-gradient px-1 text-2xl font-black sm:text-3xl">Оберіть час видачі</h1>
        <p className="px-1 text-base text-subtle">Замовлення #{orderId}</p>
      </div>
      <LinkGate>
        {/* The id goes into an API path, so a crafted URL must not reach another route. */}
        {ORDER_ID.test(orderId) ? (
          <Pickup orderId={orderId} />
        ) : (
          <Banner tone="error">Замовлення не знайдено.</Banner>
        )}
      </LinkGate>
    </div>
  );
}

function Pickup({ orderId }: { orderId: string }) {
  const { api, base, toast } = useSurface();
  const router = useRouter();
  const { busy, error, run } = useAction();
  const [info, setInfo] = useState<PickupInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [individual, setIndividual] = useState(false);

  useEffect(() => {
    let live = true;
    api.pickupInfo(orderId).then(
      (next) => {
        if (live) setInfo(next);
      },
      (err: unknown) => {
        if (live) setLoadError(errorText(err));
      },
    );
    return () => {
      live = false;
    };
  }, [api, attempt, orderId]);

  const reload = () => {
    setLoadError(null);
    setAttempt((n) => n + 1);
  };

  const confirm = async () => {
    const ok = await run(() =>
      api
        .choosePickup(orderId, { pickupSlotId: slotId, needsIndividualPickup: individual })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 400) {
            setSlotId(null); // the slot is stale: show what is left, next to the server's sentence
            reload();
          }
          throw err;
        }),
    );
    if (!ok) return;
    toast('Час видачі збережено!');
    router.push(`${base}/orders`);
  };

  if (!info) {
    if (!loadError) return <Spinner />;
    return (
      <div className="space-y-3">
        <Banner tone="error">{loadError}</Banner>
        <button type="button" onClick={reload} className={`${SECONDARY_CLASS} w-full`}>
          Спробувати ще раз
        </button>
      </div>
    );
  }

  if (!info.canChoose) {
    return <Banner tone="hint">Для цього замовлення вибір часу недоступний.</Banner>;
  }

  return (
    <div className="space-y-4">
      {info.slots.length ? (
        <div role="radiogroup" aria-label="Час видачі" className="space-y-2">
          {info.slots.map((slot) => (
            <RadioCard
              key={slot.id}
              selected={slotId === slot.id}
              onSelect={() => setSlotId(slotId === slot.id ? null : slot.id)}
            >
              {slot.label}
            </RadioCard>
          ))}
        </div>
      ) : (
        <Empty
          icon="🗓"
          title="Немає доступних слотів для видачі."
          text="Ви можете домовитись про індивідуальну видачу або обрати час пізніше."
        />
      )}

      <div>
        <CheckRow checked={individual} onChange={setIndividual}>
          Потрібна індивідуальна видача
        </CheckRow>
        <p className="pl-8 text-sm leading-relaxed text-subtle">
          {"Оберіть, якщо ви не можете забрати замовлення в запропонований час. Ми зв'яжемось з вами."}
        </p>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <Button
        className={ACTION_CLASS}
        disabled={busy || (slotId === null && !individual)}
        onClick={confirm}
      >
        {busy ? 'Зберігаємо...' : 'Підтвердити'}
      </Button>
    </div>
  );
}
