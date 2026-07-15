'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mediaUrl, type ProjectParticipant } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageUpload } from '@/components/ImageUpload';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

export default function ProjectParticipantsPage() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['project-participants'] });

  const { data: people, isLoading } = useQuery({
    queryKey: ['project-participants'],
    queryFn: () => api.projectParticipants(),
  });

  const [fullName, setFullName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () =>
      api.createProjectParticipant({
        fullName: fullName.trim(),
        photo: photo ?? undefined,
      }),
    onSuccess: () => {
      hapticNotify('success');
      setFullName('');
      setPhoto(null);
      invalidate();
    },
    onError: () => hapticNotify('error'),
  });

  const toggleHidden = useMutation({
    mutationFn: (p: ProjectParticipant) =>
      api.updateProjectParticipant(p.id, { hidden: !p.hidden }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.deleteProjectParticipant(id),
    onSuccess: () => {
      hapticNotify('success');
      invalidate();
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Люди проєктного" />

      <p className="mb-4 text-sm text-muted">
        Учасники з тегом «авто» додаються ботом із чату проєктного. Можна додати
        людину вручну або приховати будь-кого з публічного списку.
      </p>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-bg-soft p-4">
        <p className="text-sm font-semibold text-muted">Додати вручну</p>
        <Input
          label="ПІБ"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <ImageUpload label="Аватарка" value={photo} onChange={setPhoto} />
        {addMutation.error && (
          <p className="text-sm text-brand-red">
            {addMutation.error instanceof Error
              ? addMutation.error.message
              : 'Помилка'}
          </p>
        )}
        <Button
          type="button"
          disabled={!fullName.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {addMutation.isPending ? 'Додавання…' : 'Додати'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !people?.length ? (
        <p className="py-8 text-center text-sm text-subtle">
          Ще нікого немає. Додай бота в чат проєктного (адміном, з вимкненим
          privacy mode) — і він почне збирати учасників.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((p) => {
            const avatar = mediaUrl(p.photo);
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bg-soft text-lg">
                    👤
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {p.fullName}
                    {p.hidden && (
                      <span className="ml-2 text-xs font-normal text-subtle">
                        (приховано)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-subtle">
                    {p.telegramTag ?? '—'} ·{' '}
                    {p.source === 'MANUAL' ? 'вручну' : 'авто'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleHidden.mutate(p)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                >
                  {p.hidden ? 'Показати' : 'Сховати'}
                </button>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(p.id)}
                  className="rounded-lg border border-brand-red/40 px-3 py-1.5 text-sm text-brand-red transition-colors hover:bg-brand-red/10"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
