'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ChannelPost, type EventItem, type QueueItem } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUpload } from '@/components/ImageUpload';
import { RichTextArea } from '@/components/RichTextArea';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError } from '@/components/ui/FormError';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';
import { escapeHtml } from '@/lib/utils';

const MEDIA_NAMES = { photo: 'Фото', video: 'Відео', animation: 'GIF' } as const;

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

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  });

/** ISO string -> "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

function buildCaption(e: EventItem): string {
  return [
    `📢 ${escapeHtml(e.name)}`,
    '',
    `🗓 ${fmtDate(e.date, e.hasTime, e.time)}`,
    e.location?.trim() ? `📍 ${escapeHtml(e.location.trim())}` : '📍 Локація: буде повідомлено згодом',
    '',
    e.description ?? '',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();
}

export default function ChannelPage() {
  const [editing, setEditing] = useState<ChannelPost | null>(null);
  const edit = (post: ChannelPost) => {
    setEditing(post);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Публікації" />
      <Composer
        key={editing?.id ?? 'new'}
        editing={editing}
        onDone={() => setEditing(null)}
      />
      <Queue onEdit={edit} />
      <Published onEdit={edit} />
      <Publishers />
    </main>
  );
}

function Composer({
  editing,
  onDone,
}: {
  editing: ChannelPost | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ['channel-status'],
    queryFn: () => api.channelStatus(),
  });
  const { data: events, isLoading } = useQuery({
    queryKey: ['events', 'all-for-channel'],
    queryFn: () => api.events(1, 100),
  });

  // Already out in the channel: the bot can change only its text and button.
  const published = editing?.status === 'PUBLISHED';
  const [eventId, setEventId] = useState('');
  const [text, setText] = useState(editing?.text ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(editing?.imageUrl ?? null);
  // A photo, video or GIF the post took from the media chat: kept unless replaced or removed.
  const [chatMedia, setChatMedia] = useState(editing?.mediaFileId ? editing.mediaType : null);
  const [withButton, setWithButton] = useState(editing ? !!editing.buttonUrl : true);
  // Vote buttons for nominations stay as they are; the rest of the post can change.
  const voteButtons = editing?.buttons?.length ? editing.buttons : null;
  const [buttonText, setButtonText] = useState(editing?.buttonText ?? 'Зареєструватися');
  const [buttonUrl, setButtonUrl] = useState(editing?.buttonUrl ?? '');
  const [publishAt, setPublishAt] = useState(editing ? toLocalInput(editing.publishAt) : '');
  const [result, setResult] = useState<string | null>(null);

  const eventOptions = useMemo(
    () => [
      { value: '', label: 'Без заходу (довільний пост)' },
      ...(events?.items ?? []).map((e) => ({ value: e.id, label: e.name })),
    ],
    [events],
  );

  const when = publishAt ? new Date(publishAt).toISOString() : undefined;
  const mutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await api.updateChannelPost(editing.id, {
          text: text.trim(),
          ...(chatMedia || published ? {} : { imageUrl }),
          ...(voteButtons
            ? {}
            : {
                buttonUrl: withButton && buttonUrl.trim() ? buttonUrl.trim() : null,
                buttonText: buttonText.trim() || undefined,
              }),
          ...(published ? {} : { publishAt: when }),
        });
        return null;
      }
      const r = await api.postChannel({
        text: text.trim(),
        imageUrl: imageUrl ?? undefined,
        eventId: withButton && eventId ? eventId : undefined,
        buttonUrl: withButton && buttonUrl.trim() ? buttonUrl.trim() : undefined,
        buttonText: withButton ? buttonText.trim() || undefined : undefined,
        publishAt: when,
      });
      return r.scheduled
        ? `Заплановано на ${fmtWhen(when!)}`
        : `Опубліковано (повідомлення #${r.messageId})`;
    },
    onSuccess: (message) => {
      hapticNotify('success');
      qc.invalidateQueries({ queryKey: ['channel-queue'] });
      if (editing) onDone();
      else setResult(message);
    },
    onError: () => hapticNotify('error'),
  });

  const botUsername = status?.botUsername ?? null;
  const miniAppLink = (id: string) =>
    botUsername
      ? `https://t.me/${botUsername}/${status?.appName || 'app'}?startapp=event_${id}`
      : '';
  const botChatLink = (id: string) =>
    botUsername ? `https://t.me/${botUsername}?start=event_${id}` : '';

  function onPickEvent(id: string) {
    setEventId(id);
    setResult(null);
    const ev = events?.items.find((e) => e.id === id);
    if (ev) {
      setText(buildCaption(ev));
      setImageUrl(ev.photoUrl ?? null);
      setWithButton(true);
      setButtonText('Зареєструватися');
      setButtonUrl(miniAppLink(id));
    }
  }

  const canSubmit =
    text.trim().length > 0 &&
    !mutation.isPending &&
    (!withButton || eventId !== '' || buttonUrl.trim().length > 0);

  return (
    <>
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
          {editing ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-cyan/40 bg-brand-cyan/5 px-4 py-3 text-sm">
              <span className="font-semibold">
                {published ? 'Редагування поста в каналі' : 'Редагування поста з черги'}
              </span>
              <button type="button" onClick={onDone} className="text-muted hover:text-fg">
                Скасувати
              </button>
            </div>
          ) : (
            <Select
              label="Захід (підставить текст і кнопку реєстрації)"
              options={eventOptions}
              value={eventId}
              onChange={(e) => onPickEvent(e.target.value)}
            />
          )}
          {published && (
            <p className="-mt-2 text-xs text-subtle">
              Бот змінить текст і кнопку прямо в каналі. Фото, відео й час уже не змінити.
            </p>
          )}

          <RichTextArea
            label="Текст поста"
            rows={7}
            value={text}
            onChange={setText}
          />
          {editing && /<(blockquote|tg-spoiler|code|pre)\b/.test(editing.text) && (
            <p className="-mt-2 text-xs text-subtle">
              Цитати, спойлери й моноширинний текст із Telegram цей редактор не зберігає. Якщо
              міняєш текст такого поста, краще зроби це командою /queue у чаті медіа.
            </p>
          )}

          {!published && (
            <>
              {chatMedia && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-soft px-4 py-3 text-sm">
                  <span>{MEDIA_NAMES[chatMedia]} з чату медіа (без перегляду)</span>
                  <button
                    type="button"
                    onClick={() => setChatMedia(null)}
                    className="text-brand-red"
                  >
                    Прибрати
                  </button>
                </div>
              )}
              <ImageUpload
                label={chatMedia ? 'Замінити на інше' : 'Зображення'}
                accept="image/*,video/mp4,image/gif"
                value={imageUrl}
                onChange={(url) => {
                  setImageUrl(url);
                  if (url) setChatMedia(null);
                }}
              />
            </>
          )}

          {voteButtons ? (
            <p className="rounded-xl border border-border bg-bg-soft px-4 py-3 text-sm">
              Кнопки голосування: {voteButtons.map((b) => b.text).join(' · ')}
            </p>
          ) : (
            <label className="flex items-center gap-2 text-sm font-medium text-muted">
              <input
                type="checkbox"
                checked={withButton}
                onChange={(e) => setWithButton(e.target.checked)}
              />
              Додати кнопку
            </label>
          )}

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
                    ? miniAppLink(eventId) || 'https://…'
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
                        setButtonUrl(miniAppLink(eventId))
                      }
                      className="text-[11px] rounded-lg border border-purple-500/40 bg-purple-500/10 px-2 py-1 text-purple-300 hover:bg-purple-500/20 transition-colors"
                    >
                      ⚡️ 1 клік: Mini App (t.me/.../app)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const base =
                          status?.publicWebUrl ||
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
                        setButtonUrl(botChatLink(eventId))
                      }
                      className="text-[11px] rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                    >
                      💬 Через чат з ботом (?start=...)
                    </button>
                  </div>
                  <p className="text-[11px] text-muted">
                    Для відкриття Mini App в 1 клік потрібно зареєструвати додаток у @BotFather командою <code>/newapp</code> з коротким імʼям <code>{status?.appName || 'app'}</code> для <b>@{botUsername ?? 'бота'}</b>. Або оберіть «Сайт у Telegram» — він відкривається одразу без налаштувань!
                  </p>
                </div>
              )}
            </>
          )}

          {!published && (
            <div className="flex flex-col gap-1">
              <Input
                label="Коли опублікувати (за Києвом)"
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
              />
              {!editing && (
                <p className="text-xs text-subtle">
                  Порожньо — одразу. Заплановані пости зʼявляться в черзі нижче.
                </p>
              )}
            </div>
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
            disabled={!canSubmit || (!!editing && !publishAt)}
            onClick={() => mutation.mutate()}
            className="mt-1"
          >
            {mutation.isPending
              ? 'Збереження…'
              : editing
                ? 'Зберегти зміни'
                : publishAt
                  ? 'Запланувати'
                  : 'Опублікувати'}
          </Button>
        </div>
      )}
    </>
  );
}

function Queue({ onEdit }: { onEdit: (post: ChannelPost) => void }) {
  const qc = useQueryClient();
  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['channel-queue'],
    queryFn: () => api.channelQueue(),
    refetchInterval: 30_000,
  });
  const [pending, setPending] = useState<{
    item: QueueItem;
    action: 'publish' | 'delete';
  } | null>(null);

  const act = useMutation({
    mutationFn: ({ item, action }: { item: QueueItem; action: 'publish' | 'delete' }) => {
      if (action === 'delete') {
        return item.kind === 'channel'
          ? api.deleteChannelPost(item.id)
          : api.deleteNews(item.id);
      }
      return item.kind === 'channel'
        ? api.publishChannelPost(item.id)
        : api.updateNews(item.id, { publishDate: new Date().toISOString() });
    },
    onSuccess: () => {
      hapticNotify('success');
      qc.invalidateQueries({ queryKey: ['channel-queue'] });
      qc.invalidateQueries({ queryKey: ['news'] });
      setPending(null);
    },
    onError: () => {
      hapticNotify('error');
      qc.invalidateQueries({ queryKey: ['channel-queue'] });
    },
  });

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-lg font-bold">Черга</h2>
      <p className="mb-3 text-xs text-subtle">
        Відкладені пости в канал і новини на сайт, найближчі зверху. У чаті медіа те саме — команда /queue.
      </p>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-brand-red">Не вдалося завантажити чергу.</p>
      ) : !items?.length ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-subtle">
          Запланованих постів немає.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const post = item.kind === 'channel' ? item.post : null;
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-bg-soft px-2 py-0.5 font-semibold">
                    {item.kind === 'site' ? 'Сайт' : 'Канал'}
                  </span>
                  <span className="font-semibold">{fmtWhen(item.publishAt)}</span>
                  {post?.status === 'PENDING' && (
                    <span className="text-amber-300">чекає схвалення</span>
                  )}
                  {post?.status === 'FAILED' && (
                    <span className="text-brand-red">не вдалося</span>
                  )}
                  {post?.author && <span className="text-subtle">{post.author}</span>}
                </div>
                <p className="line-clamp-2 break-words text-sm">
                  {item.kind === 'site'
                    ? `«${item.news.title}»`
                    : plain(item.post.text) || 'Без тексту'}
                </p>
                {post?.error && (
                  <p className="break-words text-xs text-brand-red">{post.error}</p>
                )}
                <div className="flex gap-2">
                  {item.kind === 'channel' ? (
                    <button
                      type="button"
                      onClick={() => onEdit(item.post)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                    >
                      Ред.
                    </button>
                  ) : (
                    <Link
                      href={`/news/${item.id}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                    >
                      Ред.
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      act.reset();
                      setPending({ item, action: 'publish' });
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                  >
                    Опублікувати зараз
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      act.reset();
                      setPending({ item, action: 'delete' });
                    }}
                    aria-label="Прибрати з черги"
                    className="ml-auto rounded-lg px-2 py-1.5 text-brand-red"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!pending}
        title={
          pending?.action === 'publish'
            ? 'Опублікувати зараз?'
            : pending?.item.kind === 'site'
              ? 'Видалити новину?'
              : 'Прибрати пост із черги?'
        }
        message={
          pending?.action === 'publish'
            ? pending.item.kind === 'site'
              ? 'Новина одразу зʼявиться на сайті.'
              : 'Пост одразу вийде в каналі.'
            : undefined
        }
        confirmLabel={pending?.action === 'publish' ? 'Опублікувати' : 'Видалити'}
        loading={act.isPending}
        error={act.error}
        onCancel={() => {
          act.reset();
          setPending(null);
        }}
        onConfirm={() => pending && act.mutate(pending)}
      />
    </section>
  );
}

function Published({ onEdit }: { onEdit: (post: ChannelPost) => void }) {
  // Under the queue's key: whatever refreshes the queue refreshes this list too.
  const { data: posts } = useQuery({
    queryKey: ['channel-queue', 'published'],
    queryFn: () => api.channelPublished(),
    refetchInterval: 30_000,
  });
  if (!posts?.length) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-lg font-bold">Уже в каналі</h2>
      <p className="mb-3 text-xs text-subtle">
        Останні пости: у них можна змінити текст і кнопку. У чаті медіа те саме — /queue →
        Опубліковані.
      </p>
      <ul className="flex flex-col gap-3">
        {posts.map((post) => (
          <li
            key={post.id}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold">{fmtWhen(post.publishAt)}</span>
              {post.author && <span className="text-subtle">{post.author}</span>}
            </div>
            <p className="line-clamp-2 break-words text-sm">
              {plain(post.text) || 'Без тексту'}
            </p>
            <div>
              <button
                type="button"
                onClick={() => onEdit(post)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
              >
                Ред.
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Publishers() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['publishers'],
    queryFn: () => api.publishers(),
  });
  const [tag, setTag] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['publishers'] });
  const add = useMutation({
    mutationFn: () => api.addPublisher(tag.trim()),
    onSuccess: () => {
      setTag('');
      hapticNotify('success');
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (t: string) => api.removePublisher(t),
    onSuccess: refresh,
  });

  return (
    <Card className="mt-8 flex flex-col gap-3">
      <p className="font-semibold">Хто публікує з чату медіа</p>
      <p className="text-xs text-muted">
        Команди /post (канал), /site (сайт) і /queue (черга) у гілці медіа. Голова департаменту
        медіа і президія мають доступ завжди. Інші теж можуть написати /post, але тоді бот
        попросить схвалення і пінгне людей зі списку.
      </p>
      {data?.publishers.length ? (
        <ul className="flex flex-wrap gap-2">
          {data.publishers.map((p) => (
            <li
              key={p.telegramTag}
              className="flex items-center gap-2 rounded-full border border-border bg-bg-soft py-1 pl-3 pr-2 text-sm"
            >
              {p.telegramTag}
              {data.canManage && (
                <button
                  type="button"
                  aria-label={`Забрати доступ у ${p.telegramTag}`}
                  onClick={() => remove.mutate(p.telegramTag)}
                  className="text-brand-red"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-subtle">Поки нікому окремо не видано.</p>
      )}
      {data?.canManage ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (tag.trim()) add.mutate();
          }}
        >
          <Input
            placeholder="@username"
            className="w-full min-w-0"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <Button
            type="submit"
            className="shrink-0"
            disabled={!tag.trim() || add.isPending}
          >
            Додати
          </Button>
        </form>
      ) : (
        data && (
          <p className="text-xs text-subtle">
            Змінювати список можуть голова департаменту медіа та президія.
          </p>
        )
      )}
      <FormError error={add.error ?? remove.error} />
    </Card>
  );
}
