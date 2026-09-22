'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, mediaUrl, type RegistrationPayment } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

const PAYMENT_LABEL: Record<RegistrationPayment, string> = {
  NONE: 'Без оплати',
  DONATED: 'Задонатив',
  AT_EVENT: 'На заході',
};

const PAYMENT_BADGE_STYLE: Record<RegistrationPayment, string> = {
  NONE: 'border-border bg-surface text-subtle',
  DONATED: 'border-brand-green/30 bg-brand-green/10 text-brand-green',
  AT_EVENT: 'border-brand-orange/30 bg-brand-orange/10 text-brand-orange',
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

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv',
      }).format(new Date(iso))
    : '—';

export default function EventRegistrationsPage() {
  const { id } = useParams<{ id: string }>();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | RegistrationPayment>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'ATTENDED' | 'NOT_ATTENDED'>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event-registrations', id],
    queryFn: () => api.eventRegistrations(id),
  });
  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.event(id),
  });

  const questionLabel = useMemo(
    () => new Map((event?.questions ?? []).map((q) => [q.id, q.label] as const)),
    [event?.questions],
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
      setDownloadError(e instanceof Error ? e.message : 'Не вдалося завантажити Excel');
    } finally {
      setDownloading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (paymentFilter !== 'ALL' && item.payment !== paymentFilter) {
        return false;
      }
      if (attendanceFilter === 'ATTENDED' && !item.attended) {
        return false;
      }
      if (attendanceFilter === 'NOT_ATTENDED' && item.attended) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const inName = item.fullName.toLowerCase().includes(q);
      const inGroup = item.group.toLowerCase().includes(q);
      const inTg = item.telegramTag.toLowerCase().includes(q);
      const inAnswers = (item.answers ?? []).some((a) =>
        a.value.toLowerCase().includes(q),
      );
      return inName || inGroup || inTg || inAnswers;
    });
  }, [data?.items, search, paymentFilter, attendanceFilter]);

  const stats = useMemo(() => {
    const items = data?.items ?? [];
    const total = items.length;
    const donated = items.filter((i) => i.payment === 'DONATED').length;
    const atEvent = items.filter((i) => i.payment === 'AT_EVENT').length;
    const free = items.filter((i) => i.payment === 'NONE').length;
    const attended = items.filter((i) => i.attended).length;
    return { total, donated, atEvent, free, attended };
  }, [data?.items]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <PageHeader
        title={event ? `Реєстрації · ${event.name}` : 'Зареєстровані'}
        backHref={`/events/${id}`}
        action={
          <Button
            onClick={download}
            disabled={downloading || !data?.items.length}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <span>{downloading ? 'Експорт…' : 'Експорт в Excel'}</span>
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-bg-soft p-4">
          <div className="text-xs uppercase font-bold tracking-wider text-subtle">Всього заявок</div>
          <div className="mt-1 text-2xl font-black text-fg">{stats.total}</div>
        </div>
        <div className="rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 p-4">
          <div className="text-xs uppercase font-bold tracking-wider text-brand-cyan">Присутні на вході</div>
          <div className="mt-1 text-2xl font-black text-brand-cyan">
            {stats.attended}{' '}
            <span className="text-xs font-normal text-muted">
              ({stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0}%)
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4">
          <div className="text-xs uppercase font-bold tracking-wider text-brand-green">Задонатили</div>
          <div className="mt-1 text-2xl font-black text-brand-green">{stats.donated}</div>
        </div>
        <div className="rounded-2xl border border-brand-orange/20 bg-brand-orange/5 p-4">
          <div className="text-xs uppercase font-bold tracking-wider text-brand-orange">На вході</div>
          <div className="mt-1 text-2xl font-black text-brand-orange">{stats.atEvent}</div>
        </div>
      </div>

      {/* Search & Filters & View Switcher (Centered) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        <div className="relative flex-1 min-w-0 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за ПІБ, групою, @телеграмом…"
            className="w-full rounded-xl border border-border bg-bg-soft px-4 py-2.5 text-sm text-fg placeholder:text-subtle outline-none transition-colors focus:border-brand-cyan"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle hover:text-fg"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          {/* Payment filter pills */}
          <div className="flex items-center rounded-xl border border-border bg-bg-soft p-1 text-xs">
            <button
              onClick={() => setPaymentFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                paymentFilter === 'ALL'
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Всі
            </button>
            <button
              onClick={() => setPaymentFilter('DONATED')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                paymentFilter === 'DONATED'
                  ? 'bg-brand-green/20 text-brand-green'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Донат
            </button>
            <button
              onClick={() => setPaymentFilter('AT_EVENT')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                paymentFilter === 'AT_EVENT'
                  ? 'bg-brand-orange/20 text-brand-orange'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              На вході
            </button>
          </div>

          {/* Attendance filter pills */}
          <div className="flex items-center rounded-xl border border-border bg-bg-soft p-1 text-xs">
            <button
              onClick={() => setAttendanceFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                attendanceFilter === 'ALL'
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Всі
            </button>
            <button
              onClick={() => setAttendanceFilter('ATTENDED')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                attendanceFilter === 'ATTENDED'
                  ? 'bg-brand-cyan/20 text-brand-cyan'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              ✓ Присутні
            </button>
            <button
              onClick={() => setAttendanceFilter('NOT_ATTENDED')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                attendanceFilter === 'NOT_ATTENDED'
                  ? 'bg-white/10 text-subtle'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Очікуються
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border bg-bg-soft p-1 text-xs">
            <button
              onClick={() => setViewMode('cards')}
              title="Режим карток"
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                viewMode === 'cards'
                  ? 'bg-brand-cyan text-black shadow-sm font-black'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Картки
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Режим таблиці"
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                viewMode === 'table'
                  ? 'bg-brand-cyan text-black shadow-sm font-black'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Таблиця
            </button>
          </div>
        </div>
      </div>

      {downloadError && (
        <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-3 text-sm text-brand-red">
          {downloadError}
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-6 text-center text-sm text-brand-red">
          Не вдалося завантажити список реєстрацій.
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg-soft py-16 text-center space-y-2">
          <div className="text-3xl">📭</div>
          <p className="text-sm font-bold text-fg">
            {search || paymentFilter !== 'ALL'
              ? 'За вашими фільтрами нічого не знайдено'
              : 'Ще немає зареєстрованих учасників'}
          </p>
          <p className="text-xs text-subtle">
            {search || paymentFilter !== 'ALL'
              ? 'Спробуйте змінити пошуковий запит або скинути фільтри'
              : 'Учасники зʼявляться тут одразу після заповнення форми в боті'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* ================= CARDS VIEW (Clean & Spacious) ================= */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredItems.map((r, i) => {
            const receipt = mediaUrl(r.receiptUrl);
            return (
              <div
                key={r.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-bg-soft p-4 transition-all hover:border-border/80 hover:bg-bg-soft/90 space-y-3.5"
              >
                {/* Header: Name, index, group */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-lg bg-surface px-2 py-0.5 text-xs font-mono text-subtle border border-border">
                        #{i + 1}
                      </span>
                      <h3 className="font-bold text-base text-fg truncate">
                        {r.fullName}
                      </h3>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 px-2 py-0.5 text-xs font-mono font-bold text-brand-cyan">
                        {r.group}
                      </span>
                      <a
                        href={`https://t.me/${r.telegramTag.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-surface border border-border px-2 py-0.5 text-xs font-medium text-brand-cyan hover:underline"
                      >
                        {r.telegramTag} ↗
                      </a>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {r.attended ? (
                        <span className="rounded-xl border border-brand-cyan/40 bg-brand-cyan/15 px-2.5 py-1 text-xs font-bold text-brand-cyan flex items-center gap-1 shadow-sm">
                          <span>✓</span> Присутній
                        </span>
                      ) : (
                        <span className="rounded-xl border border-border bg-surface px-2.5 py-1 text-xs font-medium text-subtle">
                          Очікується
                        </span>
                      )}
                      <span
                        className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${
                          PAYMENT_BADGE_STYLE[r.payment]
                        }`}
                      >
                        {PAYMENT_LABEL[r.payment]}
                      </span>
                    </div>
                    {receipt && (
                      <a
                        href={receipt}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-cyan hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>🧾 Чек</span>
                        <span>↗</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Additional Info: Birth date, Reg date */}
                <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs text-subtle">
                  <span>🎂 {fmtDate(r.birthDate)}</span>
                  <span>🕒 {fmtDateTime(r.createdAt)}</span>
                </div>

                {/* Question Answers */}
                {r.answers && r.answers.length > 0 && (
                  <div className="space-y-1.5 border-t border-border/60 pt-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                      Відповіді на запитання:
                    </div>
                    <div className="space-y-1.5">
                      {r.answers.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-xl border border-border/70 bg-surface/70 p-2.5 text-xs"
                        >
                          <span className="font-semibold text-subtle block text-[11px]">
                            {questionLabel.get(a.questionId) ?? 'Питання'}:
                          </span>
                          <span className="text-fg font-medium mt-0.5 block whitespace-pre-wrap">
                            {a.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= TABLE VIEW (Spacious & Clean) ================= */
        <div className="overflow-x-auto rounded-2xl border border-border bg-bg-soft shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50 text-xs font-bold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">ПІБ</th>
                <th className="px-4 py-3.5">Група</th>
                <th className="px-4 py-3.5">Telegram</th>
                <th className="px-4 py-3.5">Присутність</th>
                <th className="px-4 py-3.5">Оплата</th>
                <th className="px-4 py-3.5">Чек</th>
                <th className="px-4 py-3.5">Відповіді</th>
                <th className="px-4 py-3.5">Дата реєстрації</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((r, i) => {
                const receipt = mediaUrl(r.receiptUrl);
                return (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-surface/40 align-top"
                  >
                    <td className="px-4 py-3.5 text-subtle font-mono">{i + 1}</td>
                    <td className="px-4 py-3.5 font-bold text-fg">
                      <div>{r.fullName}</div>
                      {r.birthDate && (
                        <div className="text-xs text-subtle font-normal mt-0.5">
                          🎂 {fmtDate(r.birthDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="rounded-lg bg-surface border border-border px-2 py-0.5 text-xs font-mono font-bold text-brand-cyan">
                        {r.group}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <a
                        href={`https://t.me/${r.telegramTag.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-cyan hover:underline font-medium"
                      >
                        {r.telegramTag} ↗
                      </a>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {r.attended ? (
                        <span className="rounded-xl border border-brand-cyan/40 bg-brand-cyan/15 px-2.5 py-1 text-xs font-bold text-brand-cyan inline-flex items-center gap-1 shadow-sm">
                          <span>✓</span> Присутній
                        </span>
                      ) : (
                        <span className="rounded-xl border border-border bg-surface px-2.5 py-1 text-xs font-medium text-subtle">
                          Очікується
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`rounded-xl border px-2.5 py-1 text-xs font-bold ${
                          PAYMENT_BADGE_STYLE[r.payment]
                        }`}
                      >
                        {PAYMENT_LABEL[r.payment]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {receipt ? (
                        <a
                          href={receipt}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 px-2 py-1 text-xs font-bold text-brand-cyan hover:underline"
                        >
                          Чек ↗
                        </a>
                      ) : (
                        <span className="text-subtle text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      {r.answers && r.answers.length > 0 ? (
                        <div className="space-y-1 text-xs">
                          {r.answers.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-lg bg-surface border border-border/60 p-1.5"
                            >
                              <span className="text-subtle font-semibold block text-[10px]">
                                {questionLabel.get(a.questionId) ?? 'Питання'}:
                              </span>
                              <span className="text-fg font-medium">{a.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-subtle text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-subtle">
                      {fmtDateTime(r.createdAt)}
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
