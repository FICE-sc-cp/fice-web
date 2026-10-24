'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type EventItem, type RegistrationPayment } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { hapticNotify } from '@/lib/telegram';

const EMPTY = { fullName: '', group: '', telegramTag: '' };

const amount = (value: string | null) => Number(value ?? 0);

/** How someone added by hand pays; nothing to pick at a free event. */
function paymentChoices(event: EventItem): { value: RegistrationPayment; label: string }[] {
  return [
    ...(event.donationAnyAmount || amount(event.feeAmount) > 0
      ? [
          {
            value: 'DONATED' as const,
            label: `Оплатив онлайн${amount(event.feeAmount) > 0 ? ` · ${amount(event.feeAmount)} грн` : ''}`,
          },
        ]
      : []),
    ...(amount(event.feeAtEventAmount) > 0
      ? [
          {
            value: 'AT_EVENT' as const,
            label: `Оплатить на вході · ${amount(event.feeAtEventAmount)} грн`,
          },
        ]
      : []),
  ];
}

/**
 * Registers someone by their Telegram tag. The bot sends them the QR ticket at
 * once, or on their first /start if they have never opened it.
 */
export function AddRegistration({ eventId, event }: { eventId: string; event?: EventItem }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [picked, setPicked] = useState<RegistrationPayment | null>(null);
  const [done, setDone] = useState<{
    ticketSent: boolean;
    waitsForStart: boolean;
    botUrl: string | null;
  } | null>(null);
  const choices = event ? paymentChoices(event) : [];
  const payment = picked ?? choices[0]?.value ?? 'NONE';

  const mutation = useMutation({
    mutationFn: () =>
      api.addEventRegistration(eventId, {
        fullName: form.fullName.trim(),
        group: form.group.trim(),
        telegramTag: form.telegramTag.trim(),
        payment,
      }),
    onSuccess: (res) => {
      hapticNotify('success');
      qc.invalidateQueries({ queryKey: ['event-registrations', eventId] });
      setDone(res);
    },
    onError: () => hapticNotify('error'),
  });

  const close = () => {
    setOpen(false);
    setDone(null);
    setForm(EMPTY);
    setPicked(null);
    mutation.reset();
  };

  const ready =
    form.fullName.trim() && form.group.trim() && form.telegramTag.trim() && !mutation.isPending;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-xs font-bold whitespace-nowrap"
      >
        + Додати
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-surface p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-fg">Додати учасника</h3>
              <button type="button" onClick={close} className="text-muted hover:text-fg text-xs p-1">
                ✕
              </button>
            </div>

            {done ? (
              <>
                <p className="rounded-xl border border-brand-green/40 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
                  {done.ticketSent
                    ? 'Додано. QR-квиток уже в людини в боті й у міні-аппі.'
                    : done.waitsForStart
                      ? 'Додано. Людина ще не відкривала бота: квиток прийде, щойно вона натисне Start, а в міні-аппі він уже є.'
                      : 'Додано, але бот не зміг надіслати квиток (можливо, людина його заблокувала). У міні-аппі квиток є.'}
                </p>
                {done.waitsForStart && done.botUrl && (
                  <p className="text-xs text-muted leading-relaxed">
                    Надішліть їй посилання на бота:{' '}
                    <a
                      href={done.botUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-brand-cyan break-all"
                    >
                      {done.botUrl}
                    </a>
                  </p>
                )}
                <Button className="w-full text-xs" onClick={close}>
                  Готово
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted leading-relaxed">
                  Бот надішле людині QR-квиток. Якщо вона ще не відкривала бота — щойно натисне
                  Start.
                </p>
                <Input
                  label="ПІБ"
                  value={form.fullName}
                  maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
                <Input
                  label="Група"
                  value={form.group}
                  maxLength={10}
                  placeholder="ІП-31"
                  onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                />
                <Input
                  label="Telegram-тег"
                  value={form.telegramTag}
                  maxLength={50}
                  placeholder="@username"
                  autoCapitalize="none"
                  onChange={(e) => setForm((f) => ({ ...f, telegramTag: e.target.value }))}
                />
                {choices.length > 0 && (
                  <fieldset className="space-y-1.5">
                    <legend className="mb-1 text-sm font-semibold text-muted">Оплата</legend>
                    {choices.map((c) => (
                      <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="manual-payment"
                          checked={payment === c.value}
                          onChange={() => setPicked(c.value)}
                          className="h-4 w-4 accent-brand-cyan"
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {mutation.error ? <FormError error={mutation.error} /> : null}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1 text-xs" onClick={close}>
                    Скасувати
                  </Button>
                  <Button
                    className="flex-1 text-xs"
                    disabled={!ready}
                    onClick={() => mutation.mutate()}
                  >
                    {mutation.isPending ? 'Додаємо…' : 'Додати'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
