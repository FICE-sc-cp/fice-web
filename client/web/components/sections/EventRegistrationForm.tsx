'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { cn, formatEventDateTime } from '@/lib/utils';
import {
  fice,
  type EventItem,
  type EventRegistrationPayload,
  type RegistrationPayment,
} from '@/lib/api';

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

interface BaseQuestionConfig {
  enabled: boolean;
  required: boolean;
  label: string;
}

interface BaseQuestionsConfig {
  fullName?: BaseQuestionConfig;
  telegramTag?: BaseQuestionConfig;
  group?: BaseQuestionConfig;
  birthDate?: BaseQuestionConfig;
  phone?: BaseQuestionConfig;
}

function TelegramIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="m20.665 3.717-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l-.313 4.674c.458 0 .66-.21.916-.457l2.199-2.138 4.574 3.379c.843.464 1.45.225 1.66-.782l3-14.135c.308-1.233-.47-1.791-1.242-1.486z" />
    </svg>
  );
}

export function EventRegistrationForm({ event }: { event: EventItem }) {
  const questions = event.questions ?? [];
  const fee = event.feeAmount != null ? Number(event.feeAmount) : 0;
  const feeAtEvent =
    event.feeAtEventAmount != null ? Number(event.feeAtEventAmount) : fee;
  const hasFee = fee > 0 || feeAtEvent > 0;

  const baseConfig: BaseQuestionsConfig = (event.baseQuestionsConfig as BaseQuestionsConfig) ?? {
    fullName: { enabled: true, required: true, label: 'ПІБ' },
    telegramTag: { enabled: true, required: true, label: 'Telegram-тег' },
    group: { enabled: true, required: true, label: 'Академічна група' },
    birthDate: { enabled: true, required: false, label: 'Дата народження' },
    phone: { enabled: false, required: false, label: 'Номер телефону' },
  };

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [telegram, setTelegram] = useState('');
  const [group, setGroup] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState<'' | RegistrationPayment>('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Bot activation modal state
  const [pendingBotSession, setPendingBotSession] = useState<{
    token: string;
    botUrl: string;
  } | null>(null);

  // Success state with recap details
  const [submittedData, setSubmittedData] = useState<{
    fullName: string;
    group: string;
    telegram: string;
    birthDate?: string;
    payment?: string;
  } | null>(null);

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

    const fnCfg = baseConfig.fullName;
    if (fnCfg?.enabled !== false && fnCfg?.required !== false) {
      if (!lastName.trim()) e.lastName = 'Вкажи прізвище';
      if (!firstName.trim()) e.firstName = 'Вкажи імʼя';
      if (!middleName.trim()) e.middleName = 'Вкажи по батькові';
    }

    const tgCfg = baseConfig.telegramTag;
    if (tgCfg?.enabled !== false && tgCfg?.required !== false) {
      if (!telegram.trim()) e.telegram = 'Вкажи Telegram-тег';
    }

    const grpCfg = baseConfig.group;
    if (grpCfg?.enabled !== false && grpCfg?.required !== false) {
      if (!group.trim()) e.group = 'Вкажи групу';
    }

    const bdCfg = baseConfig.birthDate;
    if (bdCfg?.enabled && bdCfg?.required) {
      if (!birthDate) e.birthDate = 'Вкажи дату народження';
    }

    const phCfg = baseConfig.phone;
    if (phCfg?.enabled && phCfg?.required) {
      if (!phone.trim()) e.phone = 'Вкажи номер телефону';
    }

    if (hasFee && !payment) e.payment = 'Обери спосіб оплати';
    if (payment === 'DONATED' && !receiptUrl) e.receipt = 'Додай скриншот оплати';

    for (const q of questions) {
      if (q.required && !(answers[q.id] ?? '').trim()) {
        e[`q_${q.id}`] = 'Обовʼязкове поле';
      }
    }

    if (!consent) e.consent = 'Потрібна згода на обробку персональних даних';
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
        fullName: fullName || 'Учасник',
        telegramTag: `@${telegram.trim().replace(/^@+/, '')}`,
        group: group.trim() || 'ФІОТ',
        birthDate: birthDate || undefined,
        phoneNumber: phone.trim() || undefined,
        payment: hasFee ? (payment as RegistrationPayment) : 'NONE',
        receiptUrl: receiptUrl ?? undefined,
        answers: questions
          .map((q) => ({ questionId: q.id, value: (answers[q.id] ?? '').trim() }))
          .filter((a) => a.value.length > 0),
      };

      const res = await fice.registerEvent(event.id, payload);

      if (res.requiresBotStart && res.token && res.botUrl) {
        // Show Telegram bot activation modal and poll session
        setPendingBotSession({ token: res.token, botUrl: res.botUrl });
      } else {
        // Immediate registration success
        setSubmittedData({
          fullName: fullName || firstName || 'Учасник',
          group: group.trim(),
          telegram: `@${telegram.trim().replace(/^@+/, '')}`,
          birthDate: birthDate || undefined,
          payment: hasFee ? payment : 'NONE',
        });
      }
    } catch (err: any) {
      const msg =
        err?.message || 'Не вдалося зареєструватися. Спробуй ще раз трохи згодом.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Poll pending registration session when user needs to activate bot
  useEffect(() => {
    if (!pendingBotSession) return;
    const interval = setInterval(async () => {
      try {
        const session = await fice.getRegistrationSession(pendingBotSession.token);
        if (session.completed) {
          const fullName = `${lastName.trim()} ${firstName.trim()} ${middleName.trim()}`
            .replace(/\s+/g, ' ')
            .trim();
          setPendingBotSession(null);
          setSubmittedData({
            fullName: fullName || firstName || 'Учасник',
            group: group.trim(),
            telegram: `@${telegram.trim().replace(/^@+/, '')}`,
            birthDate: birthDate || undefined,
            payment: hasFee ? payment : 'NONE',
          });
        }
      } catch {
        // keep polling until timeout
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pendingBotSession, lastName, firstName, middleName, group, telegram, birthDate, hasFee, payment]);

  const resetForm = () => {
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setTelegram('');
    setGroup('');
    setBirthDate('');
    setPhone('');
    setPayment('');
    setReceiptUrl(null);
    setAnswers({});
    setConsent(false);
    setErrors({});
    setSubmitError(null);
    setPendingBotSession(null);
    setSubmittedData(null);
  };

  // Scroll to recap card on success
  useEffect(() => {
    if (submittedData === null) return;
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [submittedData]);

  // Confetti animation on success
  useEffect(() => {
    if (submittedData === null) return;
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
    const cy = H * 0.28;
    const parts = Array.from({ length: 160 }, (_, i) => {
      const ang = (Math.PI * 2 * i) / 160 + (Math.random() - 0.5) * 0.5;
      const sp = 6 + Math.random() * 10;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp * (0.6 + Math.random() * 0.8),
        vy: Math.sin(ang) * sp - (4 + Math.random() * 5),
        w: 6 + Math.random() * 7,
        h: 8 + Math.random() * 9,
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
        const fade = t > 2500 ? Math.max(0, 1 - (t - 2500) / 2000) : 1;
        if (p.y < H + 40 && fade > 0) alive = true;
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
      if (alive && t < 5500) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [submittedData]);

  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
      active
        ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
        : 'border-border bg-surface text-muted hover:border-brand-cyan/60',
    );

  const googleCalendarUrl = () => {
    try {
      const d = new Date(event.date);
      const isoStart = d.toISOString().replace(/-|:|\.\d+/g, '');
      const dEnd = new Date(d.getTime() + 2 * 60 * 60 * 1000);
      const isoEnd = dEnd.toISOString().replace(/-|:|\.\d+/g, '');
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        event.name,
      )}&dates=${isoStart}/${isoEnd}&details=${encodeURIComponent(
        event.description || 'Захід від Студради ФІОТ',
      )}&location=${encodeURIComponent(event.location || 'КПІ ім. Ігоря Сікорського')}`;
    } catch {
      return 'https://calendar.google.com/';
    }
  };

  return (
    <div
      ref={sectionRef}
      className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-surface/40 p-6 sm:p-10 backdrop-blur-md"
    >
      {/* Active Form */}
      {submittedData === null && (
        <div>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="inline-flex flex-col items-center gap-2">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Реєстрація на захід
              </h2>
              <span aria-hidden className="h-1.5 w-full rounded-full bg-gradient-main" />
            </div>
            <p className="max-w-md text-base text-muted">
              Заповни форму, щоб забронювати своє місце на події.
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-9 flex flex-col gap-5">
            {/* Full Name Fields */}
            {baseConfig.fullName?.enabled !== false && (
              <>
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

                <Input
                  label="По батькові"
                  placeholder="Григорович"
                  maxLength={40}
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  error={errors.middleName}
                />
              </>
            )}

            {/* Group & Telegram */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {baseConfig.group?.enabled !== false && (
                <Input
                  label={baseConfig.group?.label || 'Академічна група'}
                  placeholder="ІП-31"
                  maxLength={12}
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  error={errors.group}
                />
              )}

              {baseConfig.telegramTag?.enabled !== false && (
                <div className="flex w-full flex-col gap-1.5">
                  <label className="text-sm font-semibold text-muted">
                    {baseConfig.telegramTag?.label || 'Telegram-тег'}
                  </label>
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
              )}
            </div>

            {/* Birth Date & Phone */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {baseConfig.birthDate?.enabled !== false && (
                <Input
                  label={baseConfig.birthDate?.label || 'Дата народження'}
                  type="date"
                  className="[color-scheme:dark]"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  error={errors.birthDate}
                />
              )}

              {baseConfig.phone?.enabled && (
                <Input
                  label={baseConfig.phone?.label || 'Номер телефону'}
                  placeholder="+380..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={errors.phone}
                />
              )}
            </div>

            {/* Custom Questions */}
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

            {/* Fee & Payment Section */}
            {hasFee && (
              <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface/60 p-4">
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
                  <div className="flex flex-col gap-2 pt-2">
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

            {/* Consent Checkbox (Strict Requirement 11) */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="flex cursor-pointer items-start gap-3 text-xs sm:text-sm leading-relaxed text-subtle">
                <input
                  type="checkbox"
                  className="mt-0.5 size-[18px] shrink-0 accent-brand-green"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Погоджуюся на обробку моїх даних та використання фото/відеоматеріалів із моєю участю.
                </span>
              </label>
              {errors.consent && (
                <span className="text-xs font-medium text-brand-red">
                  {errors.consent}
                </span>
              )}
            </div>

            {/* Error Message with @fice_robot Link if blocked */}
            {submitError && (
              <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-3 text-sm text-brand-red leading-relaxed">
                {submitError.includes('@fice_robot') ? (
                  <>
                    {submitError.split('@fice_robot')[0]}
                    <a
                      href="https://t.me/fice_robot"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold underline text-brand-cyan hover:text-white"
                    >
                      @fice_robot
                    </a>
                    {submitError.split('@fice_robot')[1]}
                  </>
                ) : (
                  submitError
                )}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || uploading}
              className="mt-2 w-full rounded-2xl py-4 text-base sm:text-lg font-bold"
            >
              {submitting ? 'Обробка реєстрації…' : 'Зареєструватися на захід'}
            </Button>
          </form>
        </div>
      )}

      {/* Bot Verification Modal */}
      {pendingBotSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#229ED9]/40 bg-bg p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#229ED9]/15 border border-[#229ED9]/30 text-[#229ED9]">
              <TelegramIcon className="size-8 text-[#229ED9]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-fg">
                Підтвердження реєстрації
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                Щоб гарантувати безпеку та зареєструвати Вас, активуйте нашого офіційного Telegram-бота.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-subtle leading-relaxed">
              Натисніть кнопку нижче, щоб перейти до бота та натиснути{' '}
              <span className="font-bold text-brand-cyan">«Розпочати» (Start)</span>.
              Ця сторінка оновиться автоматично!
            </div>

            <div className="space-y-3">
              <a
                href={pendingBotSession.botUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#229ED9] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#229ED9]/25 transition-transform hover:scale-[1.02] hover:bg-[#1f93cc]"
              >
                <TelegramIcon className="size-5" />
                <span>Відкрити бота у Telegram</span>
              </a>

              <div className="flex items-center justify-center gap-2 text-xs text-muted pt-1">
                <span className="size-2 rounded-full bg-[#229ED9] animate-ping" />
                <span>Очікуємо на запуск бота...</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPendingBotSession(null)}
              className="text-xs text-subtle hover:text-fg hover:underline"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {/* Success Screen & Registration Recap */}
      {submittedData !== null && (
        <div className="relative z-[2] flex flex-col items-center text-center space-y-6 py-2">
          <canvas
            ref={confettiRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
          />

          {/* Glowing Success Icon */}
          <div className="relative flex size-20 sm:size-24 items-center justify-center">
            <span
              aria-hidden
              className="absolute size-24 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(46,255,151,0.5), rgba(0,0,0,0) 70%)',
                filter: 'blur(8px)',
              }}
            />
            <span
              className="relative inline-flex size-16 sm:size-20 items-center justify-center rounded-full text-black shadow-lg"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, var(--color-brand-green) 0%, var(--color-brand-cyan) 100%)',
                boxShadow: '0 10px 30px rgba(46,255,151,0.4)',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 52 52" fill="none" aria-hidden>
                <path
                  d="M14 27 L23 36 L39 18"
                  stroke="#0a0a0a"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-fg tracking-tight">
              Ти в списку! 🎉
            </h2>
            <p className="text-sm sm:text-base text-muted max-w-md mx-auto">
              Дякуємо, <span className="text-brand-green font-bold">{submittedData.fullName}</span>! Ти успішно зареєструвався на захід.
            </p>
          </div>

          {/* Registration Details Card */}
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/60 p-5 sm:p-6 backdrop-blur-xl shadow-2xl text-left space-y-4">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-fg leading-snug">
                {event.name}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-subtle block text-[11px]">Дата та час</span>
                <span className="text-fg font-semibold mt-0.5 block">
                  {formatEventDateTime(event.date, event.hasTime, event.time)}
                </span>
              </div>
              <div>
                <span className="text-subtle block text-[11px]">Локація</span>
                <span className="text-fg font-semibold mt-0.5 block truncate">
                  {event.location?.trim() ? event.location.trim() : 'Буде повідомлено згодом'}
                </span>
              </div>
              <div>
                <span className="text-subtle block text-[11px]">Учасник</span>
                <span className="text-fg font-semibold mt-0.5 block truncate">
                  {submittedData.fullName}
                </span>
              </div>
              <div>
                <span className="text-subtle block text-[11px]">Група</span>
                <span className="text-brand-cyan font-mono font-bold mt-0.5 block">
                  {submittedData.group}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
              <span className="text-subtle">Telegram:</span>
              <a
                href={`https://t.me/${submittedData.telegram.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-cyan hover:underline"
              >
                {submittedData.telegram}
              </a>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
              <span className="text-subtle">Статус оплати:</span>
              <span className="font-bold text-fg">
                {submittedData.payment === 'DONATED'
                  ? 'Задоначено онлайн'
                  : submittedData.payment === 'AT_EVENT'
                  ? 'Оплата на вході'
                  : 'Без оплати'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md pt-2">
            <a
              href={googleCalendarUrl()}
              target="_blank"
              rel="noreferrer"
              className="flex-1 w-full text-center rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-fg transition-colors hover:border-brand-cyan hover:text-brand-cyan"
            >
              📅 Додати в Календар
            </a>
            <a
              href="https://t.me/fice_time"
              target="_blank"
              rel="noreferrer"
              className="flex-1 w-full text-center rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-brand-cyan transition-colors hover:border-brand-cyan"
            >
              📢 Канал Студради
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
