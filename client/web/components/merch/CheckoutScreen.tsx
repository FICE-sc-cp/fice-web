'use client';
/* eslint-disable @next/next/no-img-element -- the receipt is a plain /uploads file, /_next/image does not resize on production */

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { FeeRequisites } from '@/components/ui/FeeRequisites';
import { Input } from '@/components/ui/Input';
import { ApiError, fice, mediaUrl } from '@/lib/api';
import { DELIVERY_LABEL, isValidUaPhone, priceText, rememberCatalog } from '@/lib/merch';
import {
  cartHash,
  clearCart,
  dropDraft,
  loadDraft,
  newKey,
  peekDraft,
  readCart,
  removeLine,
  saveDraft,
  setQuantity,
  useCart,
  type CheckoutDraft,
  type StoredLine,
} from '@/lib/merch-cart';
import { shrinkImage } from '@/lib/merch-image';
import type {
  CartPreview,
  CreateOrderBody,
  CreatedOrder,
  Recipient,
  ShopInfo,
} from '@/lib/merch-types';
import { uploadProblem } from '@/lib/uploads';
import { cn } from '@/lib/utils';
import {
  CheckRow,
  DefaultBadge,
  LinkGate,
  RadioCard,
  RecipientFields,
  keepInView,
} from './LinkGate';
import { useSurface } from './surface';
import {
  ACTION_CLASS,
  Banner,
  CONTROL,
  FIELD_CLASS,
  PANEL_CLASS,
  PageBack,
  SECONDARY_CLASS,
  SectionTitle,
  Spinner,
  errorText,
} from './ui';

type Delivery = NonNullable<CheckoutDraft['delivery']>;

interface Loaded {
  /** Of the cart this was loaded for: an edit in the sheet or another tab loads again. */
  hash: string;
  cart: CartPreview;
  recipients: Recipient[];
  /** Payment details: only after the Telegram step. */
  shop: ShopInfo | null;
  /** A stored draft means the payment block was shown, so the customer may have paid. */
  drafted: boolean;
  draft: CheckoutDraft | null;
}

const RETRY_WAITS = [0, 2_000, 5_000, 10_000];
const SUBMIT_FAILED = 'Не вдалося оформити. Спробуйте ще раз: замовлення не задвоїться.';
const TOO_MANY = 'Забагато спроб. Зачекайте хвилину.';

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const lineName = (title: string | null, options: string, label: string) =>
  title ? (options ? `${title} (${options})` : title) : label;

const labelOf = (lines: StoredLine[], variantId: number) =>
  lines.find((l) => l.variantId === variantId)?.label ?? '';

/** The draft to work on: stored values first, then the default recipient. */
function prepareDraft(hash: string, total: string, recipients: Recipient[]): CheckoutDraft {
  const draft = loadDraft(hash, total);
  const known = recipients.some((r) => r.id === draft.recipientId);
  const typed = !!(draft.fullName || draft.phone);
  const fallback = recipients.find((r) => r.isDefault) ?? recipients[0];
  return { ...draft, recipientId: known ? draft.recipientId : typed ? undefined : fallback?.id };
}

export function CheckoutScreen() {
  const { api, askWriteAccess, base, cartOpen, kind, ready, signedIn } = useSurface();
  const router = useRouter();
  const lines = useCart();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ text: string; retry: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [created, setCreated] = useState<CreatedOrder | null>(null);

  // Only on arrival: a success empties the cart on purpose. The cart is a sheet, so back to the shop.
  useEffect(() => {
    if (ready && !readCart().length) router.replace(base);
  }, [base, ready, router]);

  useEffect(() => {
    if (!ready) return;
    const current = readCart();
    if (!current.length) return;
    let live = true;
    const request = signedIn
      ? api.startCheckout(current)
      : api.preview(current).then((cart) => ({ cart, recipients: [], shop: null }));

    request.then(
      ({ cart, recipients, shop }) => {
        if (!live) return;
        const hash = cartHash(current);
        const drafted = !!peekDraft(hash);
        let draft: CheckoutDraft | null = null;
        if (shop && (drafted || !cart.hasProblems)) {
          draft = prepareDraft(hash, cart.total, recipients);
          saveDraft(draft); // before the payment block renders: the next load relies on it
          askWriteAccess();
        }
        setLoaded({ hash, cart, recipients, shop, drafted, draft });
        setFailure(null);
      },
      (err: unknown) => {
        if (!live) return;
        const limited = err instanceof ApiError && err.status === 429;
        setFailure({ text: errorText(err, limited ? TOO_MANY : undefined), retry: !limited });
      },
    );
    return () => {
      live = false;
    };
  }, [api, askWriteAccess, attempt, ready, signedIn]);

  useEffect(() => {
    if (!created) return;
    clearCart();
    dropDraft();
    window.scrollTo({ top: 0 });
  }, [created]);

  // A cart edited in the sheet over this page, or in another tab: load the new amount once the
  // sheet is closed. Set during render, as React's "adjust state on a change" pattern; what was
  // typed survives through the draft.
  if (loaded && !cartOpen && lines.length > 0 && cartHash(lines) !== loaded.hash) {
    setLoaded(null);
    setAttempt((n) => n + 1);
  }

  if (created) return <Success order={created} />;

  const reload = () => {
    setFailure(null);
    setLoaded(null);
    setAttempt((n) => n + 1);
  };

  const updateCart = () => {
    for (const line of loaded?.cart.lines ?? []) {
      if (line.status === 'short') setQuantity(line.variantId, line.maxQuantity);
      else if (line.status !== 'ok') removeLine(line.variantId);
    }
    if (readCart().length) reload();
    else router.replace(base);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <PageBack label="Каталог" tgLabel="Назад до каталогу" />
        <h1
          className={cn(
            'px-1 font-black',
            kind === 'web'
              ? 'text-gradient text-2xl sm:text-3xl'
              : 'pt-2 text-base uppercase tracking-wider text-muted',
          )}
        >
          Оформлення замовлення
        </h1>
      </div>

      {failure ? (
        <div className="space-y-3">
          <Banner tone="error">{failure.text}</Banner>
          {failure.retry && (
            <button type="button" onClick={reload} className={cn(SECONDARY_CLASS, 'w-full')}>
              Спробувати ще раз
            </button>
          )}
        </div>
      ) : !loaded ? (
        <Spinner />
      ) : (
        <Body loaded={loaded} lines={lines} onUpdateCart={updateCart} onCreated={setCreated} />
      )}
    </div>
  );
}

function Body({
  loaded: { cart, recipients, shop, drafted, draft },
  lines,
  onUpdateCart,
  onCreated,
}: {
  loaded: Loaded;
  lines: StoredLine[];
  onUpdateCart(): void;
  onCreated(order: CreatedOrder): void;
}) {
  const { kind, openCart, signOut, signedIn } = useSurface();
  const stopped = cart.hasProblems && !drafted; // has not seen the payment details, so has not paid

  return (
    <>
      {cart.hasProblems && (
        <div className="rounded-xl bg-bg">
          <Banner tone={drafted ? 'hint' : 'error'}>
            <div className="space-y-2">
              <p className="font-bold">Деякі товари змінились:</p>
              <ul className="space-y-0.5">
                {cart.lines.flatMap((l) => {
                  const label = labelOf(lines, l.variantId);
                  if (l.status === 'short') {
                    return (
                      <li key={l.variantId}>
                        {lineName(l.title, l.options, label)}: залишилось {l.maxQuantity}
                      </li>
                    );
                  }
                  if (l.status === 'soldout') {
                    return <li key={l.variantId}>{l.title}: немає в наявності</li>;
                  }
                  if (l.status !== 'ok') {
                    return <li key={l.variantId}>{label}: товар недоступний</li>;
                  }
                  return [];
                })}
              </ul>
              {drafted && (
                <p>Якщо ви вже оплатили, завантажте квитанцію: адміністратор перевірить.</p>
              )}
              <button
                type="button"
                onClick={onUpdateCart}
                className={cn(SECONDARY_CLASS, 'text-fg')}
              >
                Оновити кошик
              </button>
            </div>
          </Banner>
        </div>
      )}

      {!stopped && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>Ваше замовлення</SectionTitle>
            <button
              type="button"
              onClick={openCart}
              className={cn(
                'min-h-[40px] rounded-lg px-1 text-sm font-bold text-brand-cyan transition-opacity hover:opacity-70',
                CONTROL,
              )}
            >
              Змінити
            </button>
          </div>
          <div className={PANEL_CLASS}>
            <ul className="space-y-2">
              {cart.lines.map((l) => (
                <li key={l.variantId} className="flex justify-between gap-3 text-base">
                  <span className="min-w-0 text-muted [overflow-wrap:anywhere]">
                    {lineName(l.title, l.options, labelOf(lines, l.variantId))} ×{l.quantity}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {priceText(l.lineTotal)} грн
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <span className="text-lg font-black">Разом</span>
              <span className="text-gradient text-2xl font-black tabular-nums">
                {priceText(cart.total)} грн
              </span>
            </div>
          </div>
        </section>
      )}

      {kind === 'web' && signedIn && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#229ED9]/30 bg-[#229ED9]/10 px-4 py-3 text-sm">
          <span className="font-semibold text-fg">Telegram підключено: статуси прийдуть у бот</span>
          <button
            type="button"
            onClick={signOut}
            className={cn(
              'shrink-0 rounded-lg px-1 font-bold text-subtle transition-colors hover:text-brand-red',
              CONTROL,
            )}
          >
            Вийти
          </button>
        </div>
      )}

      {/* Without a session a restricted line reads as gone: linking is what can bring it back. */}
      {(!stopped || !signedIn) && (
        <LinkGate>
          {draft && shop ? (
            <OrderForm
              key={draft.cartHash}
              cart={cart}
              recipients={recipients}
              shop={shop}
              initial={draft}
              lines={lines}
              onCreated={onCreated}
            />
          ) : (
            <Spinner /> // just linked: the payment details are on their way
          )}
        </LinkGate>
      )}
    </>
  );
}

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-1.5 px-1">
        <span
          aria-hidden
          className={cn(
            'flex size-[24px] shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums transition-colors duration-300',
            done ? 'bg-gradient-main text-stone-950' : 'border border-border text-subtle',
          )}
        >
          {done ? '✓' : number}
        </span>
        <SectionTitle>{title}</SectionTitle>
      </div>
      <div className={cn(PANEL_CLASS, 'space-y-3')}>{children}</div>
    </section>
  );
}

function OrderForm({
  cart,
  recipients,
  shop,
  initial,
  lines,
  onCreated,
}: {
  cart: CartPreview;
  recipients: Recipient[];
  shop: ShopInfo;
  initial: CheckoutDraft;
  lines: StoredLine[];
  onCreated(order: CreatedOrder): void;
}) {
  const { api, kind, tg } = useSurface();
  const [draft, setDraft] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // A functional update: the receipt lands seconds after the last keystroke it must not undo.
  const patch = (change: Partial<CheckoutDraft>) => setDraft((d) => ({ ...d, ...change }));

  // Every change, so a page killed during the bank trip loses nothing.
  useEffect(() => saveDraft(draft), [draft]);

  const options: Delivery[] = shop.dayfEnabled
    ? ['NOVA_POSHTA', 'DAYF', 'LATER_CAMPUS']
    : ['NOVA_POSHTA', 'LATER_CAMPUS'];
  const delivery = options.find((o) => o === draft.delivery); // DayF switched off under a draft reads as unset
  const fullName = draft.fullName ?? '';
  const phone = draft.phone ?? '';
  const address = draft.address ?? '';
  const saved = draft.recipientId !== undefined;
  const recipientReady = saved || (!!fullName.trim() && isValidUaPhone(phone));
  const addressReady = delivery !== 'NOVA_POSHTA' || !!address.trim();

  const missing = !recipientReady
    ? recipients.length && !fullName && !phone
      ? 'Оберіть отримувача'
      : 'Вкажіть ПІБ і коректний номер телефону'
    : !delivery
      ? 'Оберіть спосіб доставки'
      : !addressReady
        ? 'Вкажіть адресу для Нової Пошти'
        : !draft.receiptUrl
          ? 'Додайте скріншот квитанції'
          : null;

  const pickReceipt = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = ''; // so picking the same file again still fires
    if (!picked) return;
    setUploading(true);
    setReceiptError(null);
    try {
      const blob = await shrinkImage(picked, 1200, 0.82);
      const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
      // After shrinking: the 5 MB rule would refuse a phone photo that shrinks to 300 KB.
      const problem = uploadProblem(file, { allowPdf: false });
      if (problem) throw new Error(problem);
      const { url } = await fice.uploadReceipt(file);
      // One payment proof is one order key: the same cart next week must not hit an old order.
      patch({ receiptUrl: url, clientKey: newKey() });
      tg?.hapticNotify('success');
    } catch (err) {
      setReceiptError(errorText(err, 'Не вдалося завантажити, спробуйте ще раз'));
      tg?.hapticNotify('error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (missing || submitting || !delivery || !draft.receiptUrl) return;
    setSubmitting(true); // guard against a double tap
    setSubmitError(null);
    const body: CreateOrderBody = {
      clientKey: draft.clientKey,
      // ponytail: a cart changed in another tab goes as it stands; the mismatch lands on the card.
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        label: l.label.slice(0, 300),
      })),
      expectedTotal: draft.shownTotal, // the amount the customer actually saw
      delivery,
      ...(delivery === 'NOVA_POSHTA' && { address: address.trim() }),
      ...(saved
        ? { recipientId: draft.recipientId }
        : {
            recipientName: fullName.trim(),
            recipientPhone: phone.trim(),
            saveRecipient: draft.save ?? true,
          }),
      receiptUrl: draft.receiptUrl,
    };

    let failure: unknown;
    for (const wait of RETRY_WAITS) {
      await sleep(wait);
      try {
        const order = await api.createOrder(body);
        tg?.hapticNotify('success');
        onCreated(order);
        return;
      } catch (err) {
        failure = err;
        if (err instanceof ApiError && err.status < 500 && err.status !== 429) break;
      }
    }

    tg?.hapticNotify('error');
    setSubmitting(false);
    const answer = failure instanceof ApiError && failure.status < 500 ? failure : null;
    if (answer?.message.startsWith('Квитанцію не знайдено')) patch({ receiptUrl: undefined });
    setSubmitError(answer ? errorText(answer, SUBMIT_FAILED) : SUBMIT_FAILED);
  };

  const receipt = mediaUrl(draft.receiptUrl);
  const changed = draft.shownTotal !== cart.total;

  return (
    <div className="space-y-5">
      <Step number={1} title="Отримувач" done={recipientReady}>
        {recipients.length > 0 && (
          <div role="radiogroup" aria-label="Отримувач" className="space-y-2">
            {recipients.map((r) => (
              <RadioCard
                key={r.id}
                selected={draft.recipientId === r.id}
                onSelect={() => patch({ recipientId: r.id })}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{r.fullName}</span>
                    <span className="block text-sm font-medium text-subtle">{r.phone}</span>
                  </span>
                  {r.isDefault && <DefaultBadge />}
                </span>
              </RadioCard>
            ))}
            <RadioCard selected={!saved} onSelect={() => patch({ recipientId: undefined })}>
              Інший отримувач
            </RadioCard>
          </div>
        )}
        {!saved && (
          <>
            <RecipientFields
              name={fullName}
              phone={phone}
              onName={(next) => patch({ fullName: next })}
              onPhone={(next) => patch({ phone: next })}
            />
            <CheckRow checked={draft.save ?? true} onChange={(next) => patch({ save: next })}>
              Зберегти отримувача
            </CheckRow>
          </>
        )}
      </Step>

      <Step number={2} title="Спосіб доставки" done={!!delivery && addressReady}>
        <div role="radiogroup" aria-label="Спосіб доставки" className="space-y-2">
          {options.map((option) => (
            <RadioCard
              key={option}
              selected={delivery === option}
              onSelect={() => patch({ delivery: option })}
            >
              {DELIVERY_LABEL[option]}
            </RadioCard>
          ))}
        </div>
        {delivery === 'NOVA_POSHTA' && (
          <Input
            label="Місто та номер відділення НП"
            placeholder="Київ, відділення №5"
            maxLength={500}
            value={address}
            onChange={(e) => patch({ address: e.target.value })}
            onFocus={kind === 'tg' ? keepInView : undefined}
            className={FIELD_CLASS}
          />
        )}
      </Step>

      <Step number={3} title="Оплата" done={!!receipt}>
        <p className="text-base text-muted">
          Оплатіть{' '}
          <strong className="text-lg font-black text-fg">{priceText(cart.total)} грн</strong> за
          посиланням:
        </p>
        <FeeRequisites
          text={[
            `Відкрити Банку Monobank: ${shop.monoJarUrl}`,
            shop.cardNumber && `Або перекажіть на картку: ${shop.cardNumber}`,
          ]
            .filter(Boolean)
            .join('\n')}
          onCopy={() => tg?.hapticNotify('success')}
          className="text-sm text-muted"
        />
        <p className="text-sm text-subtle">Після оплати завантажте скріншот квитанції</p>
        {changed && (
          <Banner tone="hint">
            Сума змінилась: було {priceText(draft.shownTotal)} грн, зараз {priceText(cart.total)} грн.
            Якщо ви вже оплатили {priceText(draft.shownTotal)} грн, завантажте квитанцію: адміністратор
            перевірить.
          </Banner>
        )}
      </Step>

      <Step number={4} title="Скріншот квитанції" done={!!receipt}>
        <label
          className={cn(
            'flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center text-base font-semibold transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-cyan',
            receipt
              ? 'border-brand-green/50 bg-brand-green/10'
              : 'border-border bg-bg/50 hover:border-brand-cyan',
          )}
        >
          <input
            type="file"
            accept="image/*"
            onChange={pickReceipt}
            disabled={uploading}
            className="sr-only"
          />
          {uploading ? (
            <span className="text-muted">⏳ Завантаження…</span>
          ) : receipt ? (
            <>
              <img
                src={receipt}
                alt="Квитанція"
                className="max-h-64 rounded-xl border border-white/10 object-contain"
              />
              <span className="text-sm text-muted">Натисніть, щоб змінити</span>
            </>
          ) : (
            <>
              <span aria-hidden className="text-2xl leading-none text-brand-cyan">
                ↑
              </span>
              <span>Натисніть, щоб завантажити</span>
            </>
          )}
        </label>
        {receiptError && <Banner tone="error">{receiptError}</Banner>}
      </Step>

      <div className="space-y-2">
        {submitError && <Banner tone="error">{submitError}</Banner>}
        <Button
          className={ACTION_CLASS}
          disabled={!!missing || uploading || submitting}
          onClick={submit}
        >
          {submitting ? 'Оформлюємо...' : 'Оформити замовлення'}
        </Button>
        {missing && <p className="text-center text-sm font-semibold text-subtle">{missing}</p>}
      </div>
    </div>
  );
}

function Success({ order }: { order: CreatedOrder }) {
  const { api, base, kind, tg } = useSurface();
  const [bot, setBot] = useState(() => rememberCatalog()?.botUsername ?? null);

  // A buyer who came by a shared product link has no catalog in memory to take the bot's name from.
  useEffect(() => {
    if (kind !== 'web' || bot) return;
    let live = true;
    api.catalog().then(
      (catalog) => {
        if (live) setBot(catalog.botUsername);
      },
      () => {}, // the link is a bonus on this screen
    );
    return () => {
      live = false;
    };
  }, [api, bot, kind]);
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <div className="relative mb-6 flex size-[104px] items-center justify-center">
        <span
          aria-hidden
          className="absolute size-[84px] rounded-full border-2 border-brand-green motion-safe:animate-[su-ring_1.6s_ease-out_0.25s_infinite]"
        />
        <span
          aria-hidden
          className="relative flex size-[84px] items-center justify-center rounded-full bg-gradient-to-br from-brand-green to-brand-teal text-black shadow-[0_14px_40px_rgba(46,255,151,0.35)] motion-safe:animate-[su-pop_0.7s_cubic-bezier(0.34,1.56,0.64,1)_both]"
        >
          <svg width="46" height="46" viewBox="0 0 52 52" fill="none">
            <path
              d="M14 27 L23 36 L39 18"
              stroke="#0a0a0a"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={60}
              className="[stroke-dashoffset:0] motion-safe:[stroke-dashoffset:60] motion-safe:animate-[su-draw_0.45s_cubic-bezier(0.65,0,0.45,1)_0.55s_forwards]"
            />
          </svg>
        </span>
      </div>
      <h1 className="text-2xl font-black leading-snug sm:text-3xl">Замовлення оформлено</h1>
      <p className="max-w-sm text-base leading-relaxed text-muted">
        Замовлення #{order.id} прийнято. Ми перевіримо оплату та повідомимо вас у боті.
      </p>
      <div className="mt-3 flex w-full max-w-sm flex-col gap-2.5 sm:flex-row sm:justify-center">
        {tg?.isTelegram ? (
          <Button className={ACTION_CLASS} onClick={tg.close}>
            Закрити
          </Button>
        ) : (
          <>
            <Link
              href={base}
              className={cn(
                'inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-main px-6 py-3.5 text-base font-extrabold text-black transition-transform duration-200 hover:scale-[1.03] active:scale-95',
                CONTROL,
              )}
            >
              До каталогу
            </Link>
            {bot && (
              <a
                href={`https://t.me/${bot}`}
                target="_blank"
                rel="noreferrer"
                className={cn(SECONDARY_CLASS, 'flex-1 rounded-2xl')}
              >
                Відкрити бота
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
