'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, mediaUrl, type EventPartner } from '@/lib/api';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { FormError } from './ui/FormError';
import { ImageUpload } from './ImageUpload';
import { hapticNotify } from '@/lib/telegram';

export function EventPartners({
  eventId,
  attached,
}: {
  eventId: string;
  attached: EventPartner[];
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [websiteLink, setWebsiteLink] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['event', eventId] });

  const add = useMutation({
    mutationFn: () =>
      api.addEventPartner(eventId, {
        name: name.trim(),
        logoImage: logoImage ?? undefined,
        websiteLink: websiteLink.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
      setName('');
      setLogoImage(null);
      setWebsiteLink('');
    },
  });

  const remove = useMutation({
    mutationFn: (eventPartnerId: string) =>
      api.removeEventPartner(eventId, eventPartnerId),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
    },
  });

  return (
    <div className="mt-6 rounded-2xl border border-border bg-bg-soft p-4">
      <p className="mb-1 text-sm font-semibold text-muted">Партнери заходу</p>
      <p className="mb-3 text-xs text-subtle">
        Лише для цього заходу — у загальний список партнерів не потрапляють.
      </p>

      {remove.error ? (
        <div className="mb-3">
          <FormError error={remove.error} />
        </div>
      ) : null}

      {attached.length ? (
        <ul className="mb-4 flex flex-col gap-2">
          {attached.map((ep) => {
            const logo = mediaUrl(ep.logoImage ?? ep.partner?.logoImage ?? null);
            return (
              <li
                key={ep.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {logo && (
                    <span
                      className="size-8 shrink-0 rounded bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url(${logo})` }}
                    />
                  )}
                  <span className="truncate text-sm">
                    {ep.name ?? ep.partner?.name ?? 'Партнер'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(ep.id)}
                  disabled={remove.isPending}
                  className="shrink-0 text-sm font-semibold text-brand-red"
                >
                  Прибрати
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-4 text-xs text-subtle">Партнерів ще не додано.</p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <Input
          label="Назва партнера"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <ImageUpload label="Лого" value={logoImage} onChange={setLogoImage} />
        <Input
          label="Посилання (сайт або соцмережа)"
          placeholder="https://…"
          value={websiteLink}
          onChange={(e) => setWebsiteLink(e.target.value)}
        />
        <FormError error={add.error} />
        <Button
          type="button"
          variant="outline"
          disabled={!name.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? 'Додаємо…' : 'Додати партнера'}
        </Button>
      </div>
    </div>
  );
}
