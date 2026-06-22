'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, mediaUrl, type RegistrationPayment } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

const PAYMENT_LABEL: Record<RegistrationPayment, string> = {
  NONE: '—',
  DONATED: 'Задонатив',
  AT_EVENT: 'На заході',
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Kyiv',
      }).format(new Date(iso))
    : '—';

export default function EventRegistrationsPage() {
  const { id } = useParams<{ id: string }>();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event-registrations', id],
    queryFn: () => api.eventRegistrations(id),
  });
  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.event(id),
  });

  const questionLabel = new Map(
    (event?.questions ?? []).map((q) => [q.id, q.label] as const),
  );

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await api.exportEventRegistrations(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registrations-${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Не вдалося завантажити');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader title="Зареєстровані" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-subtle">
          {data ? `${data.total} реєстрацій` : ''}
        </span>
        <Button onClick={download} disabled={downloading || !data?.items.length}>
          {downloading ? 'Готуємо…' : 'Завантажити Excel'}
        </Button>
      </div>

      {downloadError && (
        <p className="mb-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          {downloadError}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-brand-red">Не вдалося завантажити.</p>
      ) : !data?.items.length ? (
        <p className="py-12 text-center text-sm text-subtle">Ще немає реєстрацій.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-bg-soft text-left text-xs uppercase tracking-wide text-subtle">
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">ПІБ</th>
                <th className="px-3 py-2 font-semibold">Група</th>
                <th className="px-3 py-2 font-semibold">Telegram</th>
                <th className="px-3 py-2 font-semibold">Народження</th>
                <th className="px-3 py-2 font-semibold">Оплата</th>
                <th className="px-3 py-2 font-semibold">Чек</th>
                <th className="px-3 py-2 font-semibold">Відповіді</th>
                <th className="px-3 py-2 font-semibold">Дата</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r, i) => {
                const receipt = mediaUrl(r.receiptUrl);
                return (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-subtle">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold">{r.fullName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.group}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <a
                        href={`https://t.me/${r.telegramTag.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-cyan underline-offset-2 hover:underline"
                      >
                        {r.telegramTag}
                      </a>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.birthDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {PAYMENT_LABEL[r.payment]}
                    </td>
                    <td className="px-3 py-2">
                      {receipt ? (
                        <a
                          href={receipt}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-cyan underline-offset-2 hover:underline"
                        >
                          Чек ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.answers && r.answers.length > 0 ? (
                        <ul className="flex flex-col gap-0.5 text-xs text-muted">
                          {r.answers.map((a) => (
                            <li key={a.id}>
                              <span className="text-subtle">
                                {questionLabel.get(a.questionId) ?? 'Питання'}:
                              </span>{' '}
                              {a.value}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-subtle">
                      {fmtDate(r.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
