'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, type EventItem } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUpload } from '@/components/ImageUpload';
import { RichTextArea } from '@/components/RichTextArea';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

const fmtDate = (iso: string, hasTimeFlag?: boolean, timeStr?: string | null) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const datePart = new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Kyiv',
    }).format(d);

    if (hasTimeFlag === false) return `${datePart} (час буде повідомлено згодом)`;
    if (timeStr && timeStr.trim()) return `${datePart} о ${timeStr.trim()}`;

    const timePart = new Intl.DateTimeFormat('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    }).format(d);

    if (timePart === '00:00' && hasTimeFlag !== true) return `${datePart} (час буде повідомлено згодом)`;
    return `${datePart} о ${timePart}`;
  } catch {
    return iso;
  }
};

function buildCaption(e: EventItem): string {
  return [
    `📢 ${e.name}`,
    '',
    `🗓 ${fmtDate(e.date, e.hasTime, e.time)}`,
    e.location?.trim() ? `📍 ${e.location.trim()}` : '📍 Локація: буде повідомлено згодом',
    '',
    e.description ?? '',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();
}

export default function ChannelPage() {
  const { data: status } = useQuery({
    queryKey: ['channel-status'],
    queryFn: () => api.channelStatus(),
  });
  const { data: events, isLoading } = useQuery({
    queryKey: ['events', 'all-for-channel'],
    queryFn: () => api.events(1, 100),
  });

  const [eventId, setEventId] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [withButton, setWithButton] = useState(true);
  const [buttonText, setButtonText] = useState('Зареєструватися');
  const [buttonUrl, setButtonUrl] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const eventOptions = useMemo(
    () => [
      { value: '', label: 'Без заходу (довільний пост)' },
      ...(events?.items ?? []).map((e) => ({ value: e.id, label: e.name })),
    ],
    [events],
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.postChannel({
        text: text.trim(),
        imageUrl: imageUrl ?? undefined,
        eventId: withButton && eventId ? eventId : undefined,
        buttonUrl:
          withButton && buttonUrl.trim()
            ? buttonUrl.trim()
            : undefined,
        buttonText: withButton ? buttonText.trim() || undefined : undefined,
      }),
    onSuccess: (r) => {
      hapticNotify('success');
      setResult(`Опубліковано ✅ (повідомлення #${r.messageId})`);
    },
    onError: () => hapticNotify('error'),
  });

  function onPickEvent(id: string) {
    setEventId(id);
    setResult(null);
    const ev = events?.items.find((e) => e.id === id);
    if (ev) {
      setText(buildCaption(ev));
      setImageUrl(ev.photoUrl ?? null);
      setWithButton(true);
      setButtonText('Зареєструватися');
      setButtonUrl(`https://t.me/fice_event_bot/app?startapp=event_${id}`);
    }
  }

  const canSubmit =
    text.trim().length > 0 &&
    !mutation.isPending &&
    (!withButton || eventId !== '' || buttonUrl.trim().length > 0);

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Публікація в канал" />

      {status && !status.configured && (
        <p className="mb-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          Канал не налаштований. Заповни{' '}
          {!status.botTokenSet && 'TELEGRAM_BOT_TOKEN, '}
          {!status.channelIdSet && 'TELEGRAM_CHANNEL_ID, '}
          {!status.webUrlSet && 'PUBLIC_WEB_URL '}
          у налаштуваннях сервера, щоб публікувати.
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label="Захід (підставить текст і кнопку реєстрації)"
            options={eventOptions}
            value={eventId}
            onChange={(e) => onPickEvent(e.target.value)}
          />

          <RichTextArea
            label="Текст поста"
            rows={7}
            value={text}
            onChange={setText}
          />

          <ImageUpload label="Зображення" value={imageUrl} onChange={setImageUrl} />

          <label className="flex items-center gap-2 text-sm font-medium text-muted">
            <input
              type="checkbox"
              checked={withButton}
              onChange={(e) => setWithButton(e.target.checked)}
            />
            Додати кнопку
          </label>

          {withButton && (
            <>
              <Input
                label="Підпис кнопки"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
              />
              <Input
                label="Посилання кнопки"
                placeholder={
                  eventId
                    ? `https://t.me/fice_event_bot/app?startapp=event_${eventId}`
                    : 'https://…'
                }
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
              />
              {eventId && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setButtonUrl(
                          `https://t.me/fice_event_bot/app?startapp=event_${eventId}`,
                        )
                      }
                      className="text-[11px] rounded-lg border border-purple-500/40 bg-purple-500/10 px-2 py-1 text-purple-300 hover:bg-purple-500/20 transition-colors"
                    >
                      ⚡️ 1 клік: Mini App (t.me/.../app)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const base =
                          (status as any)?.publicWebUrl ||
                          (typeof window !== 'undefined'
                            ? `${window.location.protocol}//${window.location.hostname}:3002`
                            : '');
                        setButtonUrl(
                          `${base.replace(/\/$/, '')}/events/${eventId}#register`,
                        );
                      }}
                      className="text-[11px] rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                    >
                      🌐 Сайт у Telegram (без BotFather)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setButtonUrl(
                          `https://t.me/fice_event_bot?start=event_${eventId}`,
                        )
                      }
                      className="text-[11px] rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                    >
                      💬 Через чат з ботом (?start=...)
                    </button>
                  </div>
                  <p className="text-[11px] text-muted">
                    Для відкриття Mini App в 1 клік потрібно зареєструвати додаток у @BotFather командою <code>/newapp</code> з коротким імʼям <code>app</code> для <b>@fice_event_bot</b>. Або оберіть «Сайт у Telegram» — він відкривається одразу без налаштувань!
                  </p>
                </div>
              )}
            </>
          )}

          {mutation.error && (
            <p className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Помилка'}
            </p>
          )}
          {result && (
            <p className="rounded-xl border border-brand-green/40 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
              {result}
            </p>
          )}

          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
            className="mt-1"
          >
            {mutation.isPending ? 'Публікація…' : 'Опублікувати'}
          </Button>
        </div>
      )}
    </main>
  );
}
