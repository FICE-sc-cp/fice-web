'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  fice,
  type EventItem,
  type EventRegistrationPayload,
  type RegistrationPayment,
} from '@/lib/api';

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

export function EventRegistrationForm({ event }: { event: EventItem }) {
  const questions = event.questions ?? [];
  const fee = event.feeAmount != null ? Number(event.feeAmount) : 0;
  const feeAtEvent =
    event.feeAtEventAmount != null ? Number(event.feeAtEventAmount) : fee;
  const hasFee = fee > 0 || feeAtEvent > 0;

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [telegram, setTelegram] = useState('');
  const [group, setGroup] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [payment, setPayment] = useState<'' | RegistrationPayment>('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  const sectionRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const onReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setErrors((prev) => ({ ...prev, receipt: '' }));
    try {
      const { url } = await fice.uploadReceipt(f);
      setReceiptUrl(url);
    } catch {
      setErrors((prev) => ({ ...prev, receipt: 'Не вдалося завантажити файл' }));
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!lastName.trim()) e.lastName = 'Вкажіть прізвище';
    if (!firstName.trim()) e.firstName = 'Вкажіть імʼя';
    if (!middleName.trim()) e.middleName = 'Вкажіть по батькові';
    if (!telegram.trim()) e.telegram = 'Вкажіть Telegram-тег';
    if (!group.trim()) e.group = 'Вкажіть групу';
    if (!birthDate) e.birthDate = 'Вкажіть дату народження';
    if (hasFee && !payment) e.payment = 'Оберіть спосіб оплати';
    if (payment === 'DONATED' && !receiptUrl) e.receipt = 'Додайте скриншот оплати';
    for (const q of questions) {
      if (q.required && !(answers[q.id] ?? '').trim()) {
        e[`q_${q.id}`] = 'Обовʼязкове поле';
      }
    }
    if (!consent) e.consent = 'Потрібна згода на обробку даних';
    return e;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const fullName = `${lastName.trim()} ${firstName.trim()} ${middleName.trim()}`
        .replace(/\s+/g, ' ')
        .trim();
      const payload: EventRegistrationPayload = {
        fullName,
        telegramTag: `@${telegram.trim().replace(/^@+/, '')}`,
        group: group.trim(),
        birthDate: birthDate || undefined,
        payment: hasFee ? (payment as RegistrationPayment) : 'NONE',
        receiptUrl: receiptUrl ?? undefined,
        answers: questions
          .map((q) => ({ questionId: q.id, value: (answers[q.id] ?? '').trim() }))
          .filter((a) => a.value.length > 0),
      };
      await fice.registerEvent(event.id, payload);
      setSubmittedName(firstName.trim());
    } catch {
      setSubmitError('Не вдалося зареєструватися. Спробуй ще раз трохи згодом.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setTelegram('');
    setGroup('');
    setBirthDate('');
    setPayment('');
    setReceiptUrl(null);
    setAnswers({});
    setConsent(false);
    setErrors({});
    setSubmitError(null);
    setSubmittedName(null);
  };

  useEffect(() => {
    if (submittedName === null) return;
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = setTimeout(reset, 5000);
    return () => clearTimeout(timer);
  }, [submittedName]);

  useEffect(() => {
    if (submittedName === null) return;
    const canvas = confettiRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width: W, height: H } = canvas.getBoundingClientRect();
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#2eff97', '#36dfff', '#ad46ff', '#f6339a', '#ff8904', '#00e3c5'];
    const cx = W / 2;
    const cy = H * 0.32;
    const parts = Array.from({ length: 130 }, (_, i) => {
      const ang = (Math.PI * 2 * i) / 130 + (Math.random() - 0.5) * 0.5;
      const sp = 5 + Math.random() * 9;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp * (0.6 + Math.random() * 0.8),
        vy: Math.sin(ang) * sp - (3 + Math.random() * 4),
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: colors[(Math.random() * colors.length) | 0],
        circle: Math.random() < 0.35,
      };
    });

    let raf = 0;
    let stopped = false;
    const grav = 0.22;
    const drag = 0.992;
    const start = performance.now();
    const tick = (now: number) => {
      if (stopped) return;
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.vx *= drag;
        p.vy = p.vy * drag + grav;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const fade = t > 1400 ? Math.max(0, 1 - (t - 1400) / 1100) : 1;
        if (p.y < H + 30 && fade > 0) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        if (p.circle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (alive && t < 3200) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [submittedName]);

  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
      active
        ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
        : 'border-border bg-surface text-muted hover:border-brand-cyan/60',
    );

  return (
    <div
      ref={sectionRef}
      className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-white/5 bg-surface/40 p-6 sm:p-10"
    >
      <div
        className={submittedName !== null ? 'invisible' : undefined}
        aria-hidden={submittedName !== null}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex flex-col items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Реєстрація на захід
            </h2>
            <span aria-hidden className="h-1.5 w-full rounded-full bg-gradient-main" />
          </div>
          <p className="max-w-md text-base text-muted">
            Заповни форму, щоб забронювати місце.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-9 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input
              label="Прізвище"
              placeholder="Шевченко"
              maxLength={40}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={errors.lastName}
            />
            <Input
              label="Імʼя"
              placeholder="Тарас"
              maxLength={40}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={errors.firstName}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input
              label="По батькові"
              placeholder="Григорович"
              maxLength={40}
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              error={errors.middleName}
            />
            <Input
              label="Група"
              placeholder="ІП-31"
              maxLength={10}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              error={errors.group}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex w-full flex-col gap-1.5">
              <label className="text-sm font-semibold text-muted">Telegram-тег</label>
              <div
                className={cn(
                  'flex items-center rounded-xl border bg-surface px-4 transition-colors focus-within:border-brand-cyan',
                  errors.telegram ? 'border-brand-red' : 'border-border',
                )}
              >
                <span className="pr-1 font-bold text-subtle">@</span>
                <input
                  type="text"
                  placeholder="username"
                  className="w-full bg-transparent py-3 text-fg outline-none placeholder:text-subtle"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                />
              </div>
              {errors.telegram && (
                <span className="text-xs font-medium text-brand-red">
                  {errors.telegram}
                </span>
              )}
            </div>

            <Input
              label="Дата народження"
              type="date"
              className="[color-scheme:dark]"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              error={errors.birthDate}
            />
          </div>

          {questions.map((q) => {
            const err = errors[`q_${q.id}`];
            if (q.type === 'LONG_TEXT') {
              return (
                <Textarea
                  key={q.id}
                  label={q.label}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  error={err}
                />
              );
            }
            if (q.type === 'SINGLE_CHOICE' || q.type === 'YES_NO') {
              const opts = q.type === 'YES_NO' ? ['Так', 'Ні'] : q.options;
              return (
                <div key={q.id} className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-muted">{q.label}</label>
                  <div className="flex flex-wrap gap-2">
                    {opts.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        aria-pressed={answers[q.id] === opt}
                        className={chip(answers[q.id] === opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {err && (
                    <span className="text-xs font-medium text-brand-red">{err}</span>
                  )}
                </div>
              );
            }
            return (
              <Input
                key={q.id}
                label={q.label}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                error={err}
              />
            );
          })}

          {hasFee && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-muted">
                Спосіб оплати внеску
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPayment('DONATED')}
                  aria-pressed={payment === 'DONATED'}
                  className={chip(payment === 'DONATED')}
                >
                  Задонатив онлайн{fee > 0 ? ` · ${fee} грн` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setPayment('AT_EVENT')}
                  aria-pressed={payment === 'AT_EVENT'}
                  className={chip(payment === 'AT_EVENT')}
                >
                  Оплачу на заході{feeAtEvent > 0 ? ` · ${feeAtEvent} грн` : ''}
                </button>
              </div>

              {payment === 'DONATED' && (
                <div className="flex flex-col gap-2">
                  {event.feeRequisites && (
                    <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                      Реквізити:{' '}
                      {isUrl(event.feeRequisites) ? (
                        <a
                          href={event.feeRequisites}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-bold text-brand-cyan underline-offset-2 hover:underline"
                        >
                          {event.feeRequisites}
                        </a>
                      ) : (
                        <span className="break-all font-bold text-brand-green">
                          {event.feeRequisites}
                        </span>
                      )}
                    </p>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onReceiptChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-6 text-sm font-semibold text-muted transition-colors hover:border-brand-cyan"
                  >
                    {uploading
                      ? 'Завантаження…'
                      : receiptUrl
                        ? '✓ Скриншот додано — натисни, щоб змінити'
                        : '⬆️ Додати скриншот оплати'}
                  </button>
                  {errors.receipt && (
                    <span className="text-xs font-medium text-brand-red">
                      {errors.receipt}
                    </span>
                  )}
                </div>
              )}

              {payment === 'AT_EVENT' && (
                <p className="rounded-xl border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 text-sm text-muted">
                  Не забудь взяти {feeAtEvent} грн готівкою — оплатиш на вході.
                </p>
              )}
              {errors.payment && (
                <span className="text-xs font-medium text-brand-red">
                  {errors.payment}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-subtle">
              <input
                type="checkbox"
                className="mt-0.5 size-[18px] shrink-0 accent-brand-green"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>Погоджуюсь на обробку моїх даних для участі в заході.</span>
            </label>
            {errors.consent && (
              <span className="text-xs font-medium text-brand-red">
                {errors.consent}
              </span>
            )}
          </div>

          {submitError && (
            <p className="text-sm font-medium text-brand-red">{submitError}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={submitting || uploading}
            className="mt-1 w-full rounded-2xl py-4 text-lg"
          >
            {submitting ? 'Реєструємо…' : 'Зареєструватися на захід'}
          </Button>
        </form>
      </div>

      {submittedName !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center">
          <canvas
            ref={confettiRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
          />
          <div className="relative z-[2] flex size-[120px] items-center justify-center">
            <span
              aria-hidden
              className="absolute size-[120px] rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(46,255,151,0.55), rgba(0,0,0,0) 70%)',
                filter: 'blur(6px)',
                animation: 'su-glow 2.4s ease-in-out infinite',
              }}
            />
            <span
              aria-hidden
              className="absolute size-24 rounded-full border-2 border-brand-green"
              style={{ animation: 'su-ring 1.6s ease-out 0.25s infinite' }}
            />
            <span
              aria-hidden
              className="absolute size-24 rounded-full border-2 border-brand-cyan"
              style={{ animation: 'su-ring 1.6s ease-out 0.7s infinite' }}
            />
            <span
              className="relative inline-flex size-[92px] items-center justify-center rounded-full text-black"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, var(--color-brand-green) 0%, var(--color-brand-teal) 100%)',
                boxShadow: '0 14px 40px rgba(46,255,151,0.35)',
                animation: 'su-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) both',
              }}
            >
              <svg width="50" height="50" viewBox="0 0 52 52" fill="none" aria-hidden>
                <path
                  d="M14 27 L23 36 L39 18"
                  stroke="#0a0a0a"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={60}
                  strokeDashoffset={60}
                  style={{
                    animation: 'su-draw 0.45s cubic-bezier(0.65,0,0.45,1) 0.55s forwards',
                  }}
                />
              </svg>
            </span>
          </div>
          <h2
            className="z-[2] text-3xl font-bold sm:text-4xl"
            style={{ animation: 'su-rise 0.6s ease-out 0.5s both' }}
          >
            Ти в списку! 🎉
          </h2>
          <p
            className="z-[2] max-w-md text-lg leading-relaxed text-muted"
            style={{ animation: 'su-rise 0.6s ease-out 0.66s both' }}
          >
            Дякуємо, {submittedName}! Реєстрацію прийнято — побачимось на заході.
          </p>
        </div>
      )}
    </div>
  );
}
