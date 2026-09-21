'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export default function BroadcastsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'create' | 'history'>('create');

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['broadcast-stats'],
    queryFn: () => api.broadcastStats(),
  });

  const { data: history, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['broadcast-history'],
    queryFn: () => api.broadcastHistory(1, 30),
    enabled: tab === 'history',
  });

  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const isInitialLoad = useRef(true);

  const draftKey = 'global_broadcast_draft';

  // Load draft on mount
  useEffect(() => {
    if (!isInitialLoad.current) return;
    isInitialLoad.current = false;
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
  }, []);

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
  }, [text, imageUrl, buttonText, buttonUrl]);

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

  const applyTemplate = (type: 'announcement' | 'costume' | 'urgent') => {
    if (type === 'announcement') {
      setText(
        `🎉 <b>Новий крутий захід від Студради ФІОТ!</b>\n\n` +
          `Ми підготували для вас дещо особливе. Відкривайте міні-додаток, щоб дізнатися всі деталі та зареєструватися першими!\n\n` +
          `Не проґавте шанс гарно провести час з друзями! 🔥`,
      );
      setButtonText('Переглянути заходи');
      setButtonUrl('');
    } else if (type === 'costume') {
      setText(
        `🎭 <b>Увага! Конкурс костюмів відкрито!</b>\n\n` +
          `Беріть участь у конкурсі образів, завантажуйте своє фото у Telegram-додатку та змагайтеся за призи! 🏆\n\n` +
          `Голосування розпочнеться незабаром — встигніть подати свою заявку!`,
      );
      setButtonText('Подати фото образу');
      setButtonUrl('');
    } else if (type === 'urgent') {
      setText(
        `📢 <b>Важливе оголошення!</b>\n\n` +
          `Друзі, зверніть увагу на оновлену інформацію щодо майбутніх подій та реєстрацій у нашому додатку. ` +
          `Переходьте за посиланням, щоб перевірити свій статус!`,
      );
      setButtonText('Відкрити додаток');
      setButtonUrl('');
    }
    hapticNotify('success');
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.broadcastToAll({
        text: text.trim(),
        imageUrl: imageUrl ?? undefined,
        buttonText: buttonText.trim() || undefined,
        buttonUrl: buttonUrl.trim() || undefined,
      }),
    onSuccess: (res) => {
      setConfirmOpen(false);
      hapticNotify('success');
      setResult(
        `Глобальну розсилку успішно виконано! ✅ Надіслано: ${res.sentCount}` +
          (res.failedCount > 0 ? `, не вдалося: ${res.failedCount}` : ''),
      );
      qc.invalidateQueries({ queryKey: ['broadcast-stats'] });
      qc.invalidateQueries({ queryKey: ['broadcast-history'] });
      clearDraft();
    },
    onError: () => hapticNotify('error'),
  });

  const canSubmit = text.trim().length > 0 && !mutation.isPending;

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Розсилки користувачам" />

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-surface p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-muted">Всього в боті</div>
          <div className="text-xl font-black text-fg mt-0.5">
            {isStatsLoading ? '…' : stats?.totalUsers ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-muted">Активних</div>
          <div className="text-xl font-black text-brand-cyan mt-0.5">
            {isStatsLoading ? '…' : stats?.activeUsers ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-muted">Розсилок</div>
          <div className="text-xl font-black text-brand-green mt-0.5">
            {isStatsLoading ? '…' : stats?.totalBroadcasts ?? 0}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setTab('create')}
          className={`pb-1 text-sm font-semibold transition-colors ${
            tab === 'create'
              ? 'border-b-2 border-brand-cyan text-brand-cyan'
              : 'text-muted hover:text-fg'
          }`}
        >
          Створити розсилку
        </button>
        <button
          onClick={() => setTab('history')}
          className={`pb-1 text-sm font-semibold transition-colors ${
            tab === 'history'
              ? 'border-b-2 border-brand-cyan text-brand-cyan'
              : 'text-muted hover:text-fg'
          }`}
        >
          Історія розсилок
        </button>
      </div>

      {tab === 'create' ? (
        <div>
          {result ? (
            <div className="mb-6 rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-brand-green text-sm font-medium">
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
                onClick={() => applyTemplate('announcement')}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 font-medium transition-colors"
              >
                🎉 Анонс нового заходу
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('costume')}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 font-medium transition-colors"
              >
                🎭 Конкурс костюмів (фото)
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('urgent')}
                className="text-xs px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-medium transition-colors"
              >
                📢 Важливе оголошення
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
              label="Текст глобальної розсилки (HTML)"
              value={text}
              onChange={setText}
              placeholder="Введіть повідомлення для ВСІХ зареєстрованих користувачів бота..."
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
                placeholder="Наприклад: Відкрити додаток"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
              />
              <Input
                label="Посилання кнопки"
                placeholder="https://..."
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
              />
            </div>

            {mutation.error ? <FormError error={mutation.error} /> : null}

            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || (stats?.activeUsers ?? 0) === 0}
            >
              {mutation.isPending ? 'Відправка…' : 'Надіслати всім користувачам'}
            </Button>
          </form>

          <ConfirmDialog
            open={confirmOpen}
            title="Підтвердити глобальну розсилку"
            message={`Ви збираєтеся надіслати повідомлення ВСІМ користувачам бота (${stats?.activeUsers ?? 0} отримувачів). Це повідомлення побачать усі підписники. Продовжити?`}
            confirmLabel="Надіслати всім"
            loading={mutation.isPending}
            error={mutation.error}
            onConfirm={() => mutation.mutate()}
            onCancel={() => setConfirmOpen(false)}
          />
        </div>
      ) : (
        <div>
          {isHistoryLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (history?.items ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted text-sm">
              Історія розсилок порожня.
            </div>
          ) : (
            <div className="space-y-3">
              {history?.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-surface p-4 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        item.target === 'ALL_BOT_USERS'
                          ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                          : 'bg-brand-purple/20 text-brand-purple border border-brand-purple/30'
                      }`}
                    >
                      {item.target === 'ALL_BOT_USERS'
                        ? 'Всі користувачі'
                        : `Захід: ${item.event?.name ?? '—'}`}
                    </span>
                    <span className="text-muted">
                      {new Date(item.createdAt).toLocaleString('uk-UA', {
                        timeZone: 'Europe/Kyiv',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-fg line-clamp-3 whitespace-pre-line font-mono bg-bg/50 p-2 rounded-xl">
                    {item.text}
                  </p>
                  <div className="flex justify-between items-center text-[11px] text-muted pt-1 border-t border-border">
                    <div>
                      Отримувачів: <b className="text-fg">{item.recipientsCount}</b>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-brand-green">Успішно: {item.sentCount}</span>
                      {item.failedCount > 0 && (
                        <span className="text-red-400">Невдало: {item.failedCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
