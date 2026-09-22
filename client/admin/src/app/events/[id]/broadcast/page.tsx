'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RichTextArea } from '@/components/RichTextArea';
import { ImageUpload } from '@/components/ImageUpload';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError } from '@/components/ui/FormError';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

export default function EventBroadcastPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const templateParam = searchParams.get('template');
  const votingIdParam = searchParams.get('votingId');

  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.event(id),
  });

  const { data: preview } = useQuery({
    queryKey: ['event-broadcast-preview', id],
    queryFn: () => api.broadcastEventPreview(id),
  });

  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const isInitialLoad = useRef(true);

  const draftKey = `event_broadcast_draft_${id}`;

  // Load draft or apply template on mount
  useEffect(() => {
    if (!isInitialLoad.current) return;
    isInitialLoad.current = false;

    if (templateParam === 'costume_contest') {
      applyTemplate('costume_contest');
      return;
    }

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.text) setText(parsed.text);
        if (parsed.imageUrl) setImageUrl(parsed.imageUrl);
        if (parsed.buttonText) setButtonText(parsed.buttonText);
        if (parsed.buttonUrl) setButtonUrl(parsed.buttonUrl);
        setHasDraft(true);
      }
    } catch {}
  }, [templateParam, event]);

  // Auto-save draft
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (text || imageUrl || buttonText || buttonUrl) {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ text, imageUrl, buttonText, buttonUrl }),
        );
        setHasDraft(true);
      } catch {}
    }
  }, [text, imageUrl, buttonText, buttonUrl, draftKey]);

  const clearDraft = () => {
    setText('');
    setImageUrl(null);
    setButtonText('');
    setButtonUrl('');
    setHasDraft(false);
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    hapticNotify('warning');
  };

  const getContestLink = () => {
    if (votingIdParam && preview?.defaultUrls?.votingMiniApp) {
      return preview.defaultUrls.votingMiniApp.replace(/startapp=[^&]+/, `startapp=vote_${votingIdParam}`);
    }
    if (votingIdParam && preview?.botUsername) {
      return `https://t.me/${preview.botUsername}/app?startapp=vote_${votingIdParam}`;
    }
    return preview?.defaultUrls?.votingMiniApp || preview?.defaultUrls?.eventMiniApp || '';
  };

  const getEventLink = () => {
    return preview?.defaultUrls?.eventMiniApp || '';
  };

  const getWebLink = () => {
    return preview?.defaultUrls?.webEvent || '';
  };

  // If costume_contest template is used and preview loads later, update empty buttonUrl
  useEffect(() => {
    if (templateParam === 'costume_contest' && !buttonUrl) {
      const link = getContestLink();
      if (link) setButtonUrl(link);
    }
  }, [preview, templateParam]);

  const applyTemplate = (type: 'costume_contest' | 'registration' | 'voting_start' | 'reminder') => {
    const eventName = event?.name || 'захід';
    const loc = event?.location?.trim()
      ? `📍 Локація: ${event.location.trim()}`
      : '📍 Локація: буде повідомлено згодом';
    const timeStr =
      event?.hasTime === false
        ? '(час буде повідомлено згодом)'
        : event?.time?.trim()
        ? `о ${event.time.trim()}`
        : '';
    const dt = event?.date
      ? `📅 Дата: ${new Date(event.date).toLocaleDateString('uk-UA')}${timeStr ? ` ${timeStr}` : ''}`
      : '';

    if (type === 'costume_contest') {
      setText(
        `🎭 <b>Конкурс костюмів відкрито!</b>\n\n` +
          `Прийом заявок на конкурс образів для заходу <b>${eventName}</b> офіційно розпочато!\n\n` +
          `Завантажуйте фото свого образу просто зараз у нашому Telegram-додатку. ` +
          `Найкращі образи визначать глядачі шляхом голосування! 🏆`,
      );
      setButtonText('Подати фото образу');
      setButtonUrl(getContestLink());
      if (event?.photoUrl) setImageUrl(event.photoUrl);
    } else if (type === 'registration') {
      setText(
        `👋 <b>Реєстрація на захід: ${eventName}</b>\n\n` +
          `Нагадуємо про відкриту реєстрацію на подію!\n${loc}\n${dt}\n\n` +
          `Не забудьте зареєструватися, щоб підтвердити участь та отримати доступ до всіх активностей заходу. Чекаємо саме на тебе! ✨`,
      );
      setButtonText('Зареєструватися');
      setButtonUrl(getEventLink());
      if (event?.photoUrl) setImageUrl(event.photoUrl);
    } else if (type === 'voting_start') {
      setText(
        `🗳️ <b>Голосування розпочато!</b>\n\n` +
          `Обирайте своїх фаворитів на заході <b>${eventName}</b>!\n` +
          `Переходьте в додаток та віддайте свій голос прямо зараз. Кожен голос має значення! 🔥`,
      );
      setButtonText('Проголосувати');
      setButtonUrl(getContestLink());
    } else if (type === 'reminder') {
      setText(
        `⏰ <b>Нагадування: захід починається незабаром!</b>\n\n` +
          `Чекаємо на вас на <b>${eventName}</b>!\n${loc}\n${dt}\n\n` +
          `Будь ласка, відкрийте підтвердження реєстрації у додатку для швидкого проходу на вході. До зустрічі! 🎉`,
      );
      setButtonText('Моя реєстрація');
      setButtonUrl(getEventLink());
    }
    hapticNotify('success');
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.broadcastToEvent(id, {
        text: text.trim(),
        imageUrl: imageUrl ?? undefined,
        buttonText: buttonText.trim() || undefined,
        buttonUrl: buttonUrl.trim() || undefined,
      }),
    onSuccess: (res) => {
      setConfirmOpen(false);
      hapticNotify('success');
      setResult(
        `Розсилку завершено! ✅ Надіслано: ${res.sentCount} користувачам` +
          (res.failedCount > 0 ? `, не вдалося: ${res.failedCount}` : ''),
      );
      clearDraft();
    },
    onError: () => {
      hapticNotify('error');
    },
  });

  const canSubmit = text.trim().length > 0 && !mutation.isPending;

  if (isEventLoading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6 flex justify-center">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader
        title={event?.name ? `Розсилка: ${event.name}` : 'Розсилка учасникам'}
        backHref={`/events/${id}`}
      />

      <div className="mb-5 rounded-2xl border border-border bg-surface p-4">
        <div className="text-xs uppercase tracking-wider text-muted font-bold">
          Аудиторія розсилки
        </div>
        <div className="mt-1 text-2xl font-black text-brand-cyan">
          {preview?.recipientsCount ?? 0}{' '}
          <span className="text-sm font-normal text-muted">
            зареєстрованих учасників
          </span>
        </div>
      </div>

      {result ? (
        <div className="mb-6 rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-brand-green font-medium">
          {result}
        </div>
      ) : null}

      {/* Quick Templates & Draft Toolbar */}
      <div className="mb-4 rounded-2xl border border-border bg-surface p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            ⚡ Швидкі шаблони
          </span>
          {hasDraft && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-brand-green flex items-center gap-1 font-medium">
                💾 Чернетку збережено
              </span>
              <button
                type="button"
                onClick={clearDraft}
                className="text-[11px] text-red-400 hover:underline"
              >
                Очистити форму
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyTemplate('costume_contest')}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 font-medium transition-colors"
          >
            🎭 Конкурс костюмів (фото)
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('registration')}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 font-medium transition-colors"
          >
            📝 Реєстрація на захід
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('voting_start')}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-medium transition-colors"
          >
            🗳️ Старт голосування
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('reminder')}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-white/20 bg-white/5 text-muted hover:text-fg hover:bg-white/10 font-medium transition-colors"
          >
            ⏰ Нагадування
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) setConfirmOpen(true);
        }}
        className="space-y-4"
      >
        <RichTextArea
          label="Текст повідомлення (HTML)"
          value={text}
          onChange={setText}
          placeholder="Напишіть сповіщення для учасників заходу..."
        />

        <div>
          <label className="mb-1 block text-sm font-semibold">
            Зображення (опціонально)
          </label>
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
          <div className="text-sm font-semibold text-fg">
            Інлайн-кнопка (опціонально)
          </div>
          <Input
            label="Текст кнопки"
            placeholder="Наприклад: Перейти до чату"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
          />
          <Input
            label="Посилання кнопки"
            placeholder="https://..."
            value={buttonUrl}
            onChange={(e) => setButtonUrl(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted mr-1">Швидке посилання:</span>
            {preview?.defaultUrls?.eventMiniApp && (
              <button
                type="button"
                onClick={() => {
                  setButtonUrl(preview.defaultUrls!.eventMiniApp);
                  if (!buttonText) setButtonText('Відкрити в боті');
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan font-medium transition-colors"
              >
                🔗 Подія в боті
              </button>
            )}
            {(votingIdParam || preview?.defaultUrls?.votingMiniApp) && (
              <button
                type="button"
                onClick={() => {
                  setButtonUrl(getContestLink());
                  if (!buttonText) setButtonText('Подати фото образу');
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-medium transition-colors"
              >
                🎭 Конкурс в боті
              </button>
            )}
            {preview?.defaultUrls?.webEvent && (
              <button
                type="button"
                onClick={() => {
                  setButtonUrl(preview.defaultUrls!.webEvent);
                  if (!buttonText) setButtonText('Сторінка на сайті');
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-muted hover:text-fg font-medium transition-colors"
              >
                🌐 Сайт заходу
              </button>
            )}
          </div>
        </div>

        {mutation.error ? <FormError error={mutation.error} /> : null}

        <Button
          type="submit"
          className="w-full"
          disabled={!canSubmit || (preview?.recipientsCount ?? 0) === 0}
        >
          {mutation.isPending ? 'Надсилається…' : 'Надіслати розсилку'}
        </Button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Підтвердити розсилку"
        message={`Ви дійсно бажаєте надіслати це повідомлення ${preview?.recipientsCount ?? 0} зареєстрованим учасникам?`}
        confirmLabel="Надіслати"
        loading={mutation.isPending}
        error={mutation.error}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
