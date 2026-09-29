'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  mediaUrl,
  type RegistrationPayment,
  type PaymentStatus,
  type RegistrationSource,
} from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { hapticNotify } from '@/lib/telegram';

const PAYMENT_LABEL: Record<RegistrationPayment, string> = {
  NONE: 'Без оплати',
  DONATED: 'Задонатив',
  AT_EVENT: 'На вході',
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  NOT_REQUIRED: 'Оплата не потрібна',
  PENDING: 'Очікує перевірки',
  CONFIRMED: 'Підтверджено',
  REJECTED: 'Відхилено',
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
  const qc = useQueryClient();

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'AT_EVENT' | 'REJECTED'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | RegistrationSource>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'ATTENDED' | 'NOT_ATTENDED'>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Reject modal state
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    regId: string | null;
    fullName: string;
    reason: string;
  }>({
    open: false,
    regId: null,
    fullName: '',
    reason: '',
  });

  // Receipt preview modal state (view screenshot without leaving page)
  const [receiptModal, setReceiptModal] = useState<{
    open: boolean;
    receiptUrl: string | null;
    fullName: string;
    telegramTag: string;
    group: string;
    regId: string | null;
    paymentStatus: PaymentStatus;
    payment: RegistrationPayment;
    receiptIsPdf: boolean;
  }>({
    open: false,
    receiptUrl: null,
    fullName: '',
    telegramTag: '',
    group: '',
    regId: null,
    paymentStatus: 'NOT_REQUIRED',
    payment: 'NONE',
    receiptIsPdf: false,
  });

  const openReceiptModal = (r: {
    id: string;
    receiptUrl?: string | null;
    fullName: string;
    telegramTag: string;
    group: string;
    paymentStatus?: PaymentStatus;
    payment: RegistrationPayment;
  }) => {
    setReceiptModal({
      open: true,
      receiptUrl: r.receiptUrl ?? null,
      fullName: r.fullName,
      telegramTag: r.telegramTag,
      group: r.group,
      regId: r.id,
      paymentStatus: r.paymentStatus ?? 'NOT_REQUIRED',
      payment: r.payment,
      receiptIsPdf: Boolean(r.receiptUrl?.toLowerCase().endsWith('.pdf')),
    });
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event-registrations', id],
    queryFn: () => api.eventRegistrations(id),
  });

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.event(id),
  });

  const confirmMutation = useMutation({
    mutationFn: (registrationId: string) =>
      api.confirmRegistrationPayment(id, registrationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-registrations', id] });
      hapticNotify('success');
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Не вдалося підтвердити оплату');
      hapticNotify('error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      registrationId,
      reason,
    }: {
      registrationId: string;
      reason?: string;
    }) => api.rejectRegistrationPayment(id, registrationId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-registrations', id] });
      hapticNotify('success');
      setRejectModal({ open: false, regId: null, fullName: '', reason: '' });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Не вдалося відхилити оплату');
      hapticNotify('error');
    },
  });

  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    regId: string | null;
    fullName: string;
    reason: string;
  }>({
    open: false,
    regId: null,
    fullName: '',
    reason: '',
  });

  const cancelMutation = useMutation({
    mutationFn: ({
      registrationId,
      reason,
    }: {
      registrationId: string;
      reason?: string;
    }) => api.cancelEventRegistration(id, registrationId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-registrations', id] });
      hapticNotify('success');
      setCancelModal({ open: false, regId: null, fullName: '', reason: '' });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Не вдалося скасувати реєстрацію');
      hapticNotify('error');
    },
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
      // Source filter
      if (sourceFilter !== 'ALL' && (item.source || 'BOT') !== sourceFilter) {
        return false;
      }

      // Payment filter
      if (paymentFilter === 'PENDING') {
        const isPending =
          item.paymentStatus === 'PENDING' ||
          (item.payment === 'DONATED' && !item.paymentStatus);
        if (!isPending) return false;
      } else if (paymentFilter === 'CONFIRMED') {
        if (item.paymentStatus !== 'CONFIRMED') return false;
      } else if (paymentFilter === 'REJECTED') {
        if (item.paymentStatus !== 'REJECTED') return false;
      } else if (paymentFilter === 'AT_EVENT') {
        if (item.payment !== 'AT_EVENT') return false;
      }

      // Attendance filter
      if (attendanceFilter === 'ATTENDED' && !item.attended) {
        return false;
      }
      if (attendanceFilter === 'NOT_ATTENDED' && item.attended) {
        return false;
      }

      // Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const inName = item.fullName.toLowerCase().includes(q);
      const inGroup = item.group.toLowerCase().includes(q);
      const inTg = item.telegramTag.toLowerCase().includes(q);
      const inTicket = (item.ticketCode || '').toLowerCase().includes(q);
      const inAnswers = (item.answers ?? []).some((a) =>
        a.value.toLowerCase().includes(q),
      );
      return inName || inGroup || inTg || inTicket || inAnswers;
    });
  }, [data?.items, search, paymentFilter, sourceFilter, attendanceFilter]);

  const analytics = useMemo(() => {
    const items = data?.items ?? [];
    const serverStats = data?.analytics;

    const total = serverStats?.total ?? items.length;
    const max = serverStats?.maxRegistrations ?? event?.maxRegistrations ?? null;
    const isClosedByDate = serverStats?.isClosedByDate ?? false;
    const isClosedByLimit = serverStats?.isClosedByLimit ?? (max != null && total >= max);

    const webCount =
      serverStats?.webCount ?? items.filter((i) => i.source === 'WEB').length;
    const botCount =
      serverStats?.botCount ?? items.filter((i) => (i.source || 'BOT') === 'BOT').length;

    const pendingPayments =
      serverStats?.pendingPaymentCount ??
      items.filter(
        (i) => i.paymentStatus === 'PENDING' || (i.payment === 'DONATED' && !i.paymentStatus),
      ).length;

    const confirmedPayments =
      serverStats?.confirmedPaymentCount ??
      items.filter((i) => i.paymentStatus === 'CONFIRMED').length;

    const rejectedPayments =
      serverStats?.rejectedPaymentCount ??
      items.filter((i) => i.paymentStatus === 'REJECTED').length;

    const attended =
      serverStats?.attendedCount ?? items.filter((i) => i.attended).length;

    return {
      total,
      max,
      isClosedByDate,
      isClosedByLimit,
      webCount,
      botCount,
      pendingPayments,
      confirmedPayments,
      rejectedPayments,
      attended,
    };
  }, [data, event]);

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

      {/* Summary KPI Analytics Dashboard */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Capacity & Limits */}
        <div className="rounded-2xl border border-border bg-bg-soft p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-subtle">
              Всього реєстрацій
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-fg">{analytics.total}</span>
              {analytics.max ? (
                <span className="text-sm font-bold text-muted">
                  / {analytics.max} місць
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3">
            {analytics.isClosedByLimit ? (
              <span className="inline-flex rounded-lg border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-400">
                🔴 Ліміт місць вичерпано
              </span>
            ) : analytics.isClosedByDate ? (
              <span className="inline-flex rounded-lg border border-brand-orange/40 bg-brand-orange/15 px-2 py-0.5 text-[11px] font-bold text-brand-orange">
                ⏰ Реєстрацію закрито
              </span>
            ) : analytics.max ? (
              <span className="inline-flex rounded-lg border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-[11px] font-bold text-brand-green">
                🟢 Вільно: {Math.max(0, analytics.max - analytics.total)}
              </span>
            ) : (
              <span className="inline-flex rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-bold text-muted">
                🟢 Без ліміту
              </span>
            )}
          </div>
        </div>

        {/* Source Analytics (Web vs Bot) */}
        <div className="rounded-2xl border border-border bg-bg-soft p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-subtle">
              Джерела реєстрацій
            </div>
            <div className="mt-2 space-y-1.5 text-xs font-semibold">
              <div className="flex items-center justify-between">
                <span className="text-fg flex items-center gap-1.5">
                  <span>🌐</span> Сайт
                </span>
                <span className="font-bold text-brand-cyan">
                  {analytics.webCount}{' '}
                  <span className="text-[11px] font-normal text-muted">
                    ({analytics.total > 0 ? Math.round((analytics.webCount / analytics.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg flex items-center gap-1.5">
                  <span>🤖</span> Telegram-бот
                </span>
                <span className="font-bold text-fg">
                  {analytics.botCount}{' '}
                  <span className="text-[11px] font-normal text-muted">
                    ({analytics.total > 0 ? Math.round((analytics.botCount / analytics.total) * 100) : 0}%)
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-surface overflow-hidden border border-white/5 flex">
            <div
              className="h-full bg-brand-cyan"
              style={{
                width: `${analytics.total > 0 ? (analytics.webCount / analytics.total) * 100 : 0}%`,
              }}
              title="Сайт"
            />
            <div
              className="h-full bg-white/30"
              style={{
                width: `${analytics.total > 0 ? (analytics.botCount / analytics.total) * 100 : 0}%`,
              }}
              title="Бот"
            />
          </div>
        </div>

        {/* Payment Moderation */}
        <div
          className={`rounded-2xl border p-4 flex flex-col justify-between transition-colors ${
            analytics.pendingPayments > 0
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-border bg-bg-soft'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase font-bold tracking-wider text-subtle">
                Перевірка оплат
              </div>
              {analytics.pendingPayments > 0 && (
                <span className="animate-pulse rounded-full bg-amber-400 h-2 w-2" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-2xl font-black ${
                  analytics.pendingPayments > 0 ? 'text-amber-300' : 'text-fg'
                }`}
              >
                {analytics.pendingPayments}
              </span>
              <span className="text-xs font-bold text-muted">очікують розгляду</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
            <span className="text-brand-green font-bold">
              ✓ Підтверджено: {analytics.confirmedPayments}
            </span>
            {analytics.rejectedPayments > 0 && (
              <span className="text-red-400 font-bold">
                ✕ Відхилено: {analytics.rejectedPayments}
              </span>
            )}
          </div>
        </div>

        {/* Entrance Attendance / Check-In */}
        <div className="rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-brand-cyan">
              Присутні на вході
            </div>
            <div className="mt-1 text-2xl font-black text-brand-cyan">
              {analytics.attended}{' '}
              <span className="text-xs font-normal text-muted">
                ({analytics.total > 0 ? Math.round((analytics.attended / analytics.total) * 100) : 0}%)
              </span>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-surface overflow-hidden border border-white/5">
            <div
              className="h-full bg-brand-cyan transition-all"
              style={{
                width: `${analytics.total > 0 ? (analytics.attended / analytics.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 min-w-0 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук за ПІБ, групою, @телеграмом, кодом квитка…"
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

          {/* View mode toggle */}
          <div className="flex items-center rounded-xl border border-border bg-bg-soft p-1 text-xs shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setViewMode('cards')}
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

        {/* Filter Pills Groups */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Payment & Review status filter */}
          <div className="flex items-center rounded-xl border border-border bg-bg-soft p-1">
            <button
              onClick={() => setPaymentFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                paymentFilter === 'ALL'
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Всі оплати
            </button>
            <button
              onClick={() => setPaymentFilter('PENDING')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors flex items-center gap-1 ${
                paymentFilter === 'PENDING'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                  : 'text-amber-300/80 hover:text-amber-200'
              }`}
            >
              <span>⏳ На перевірці</span>
              {analytics.pendingPayments > 0 && (
                <span className="rounded-full bg-amber-400 text-black px-1.5 py-0.2 text-[10px] font-black">
                  {analytics.pendingPayments}
                </span>
              )}
            </button>
            <button
              onClick={() => setPaymentFilter('CONFIRMED')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                paymentFilter === 'CONFIRMED'
                  ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              ✓ Підтверджені
            </button>
            <button
              onClick={() => setPaymentFilter('AT_EVENT')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                paymentFilter === 'AT_EVENT'
                  ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              На вході
            </button>
            <button
              onClick={() => setPaymentFilter('REJECTED')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                paymentFilter === 'REJECTED'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Відхилені
            </button>
          </div>

          {/* Source filter pills */}
          <div className="flex items-center rounded-xl border border-border bg-bg-soft p-1">
            <button
              onClick={() => setSourceFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                sourceFilter === 'ALL'
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Всі канали
            </button>
            <button
              onClick={() => setSourceFilter('WEB')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                sourceFilter === 'WEB'
                  ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              🌐 Сайт
            </button>
            <button
              onClick={() => setSourceFilter('BOT')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                sourceFilter === 'BOT'
                  ? 'bg-white/10 text-fg border border-white/20'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              🤖 Бот
            </button>
          </div>

          {/* Attendance filter pills */}
          <div className="flex items-center rounded-xl border border-border bg-bg-soft p-1">
            <button
              onClick={() => setAttendanceFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                attendanceFilter === 'ALL'
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Всі
            </button>
            <button
              onClick={() => setAttendanceFilter('ATTENDED')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                attendanceFilter === 'ATTENDED'
                  ? 'bg-brand-cyan/20 text-brand-cyan'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              ✓ Присутні
            </button>
            <button
              onClick={() => setAttendanceFilter('NOT_ATTENDED')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                attendanceFilter === 'NOT_ATTENDED'
                  ? 'bg-white/10 text-subtle'
                  : 'text-subtle hover:text-fg'
              }`}
            >
              Очікуються
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
            {search || paymentFilter !== 'ALL' || sourceFilter !== 'ALL'
              ? 'За вашими фільтрами нічого не знайдено'
              : 'Ще немає зареєстрованих учасників'}
          </p>
          <p className="text-xs text-subtle">
            Спробуйте змінити фільтри або скинути параметри пошуку
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* ================= CARDS VIEW ================= */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredItems.map((r, i) => {
            const receipt = mediaUrl(r.receiptUrl);
            const isPdf = r.receiptUrl?.toLowerCase().endsWith('.pdf');
            const isPending =
              r.paymentStatus === 'PENDING' ||
              (r.payment === 'DONATED' && !r.paymentStatus);

            return (
              <div
                key={r.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition-all space-y-3.5 ${
                  isPending
                    ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70'
                    : r.paymentStatus === 'CONFIRMED'
                    ? 'border-brand-green/30 bg-bg-soft hover:border-brand-green/50'
                    : 'border-border bg-bg-soft hover:border-border/80'
                }`}
              >
                {/* Header: Name, index, group, channel tag */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="shrink-0 rounded-lg bg-surface px-2 py-0.5 text-xs font-mono text-subtle border border-border">
                        #{i + 1}
                      </span>
                      <h3 className="font-bold text-base text-fg truncate">
                        {r.fullName}
                      </h3>
                      {r.source === 'WEB' ? (
                        <span className="rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-cyan">
                          🌐 Сайт
                        </span>
                      ) : (
                        <span className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-muted">
                          🤖 Бот
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="rounded-lg bg-surface border border-border px-2 py-0.5 text-xs font-mono font-bold text-brand-cyan">
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
                      {r.ticketCode && (
                        <span className="text-[11px] font-mono text-muted">
                          Квиток: #{r.ticketCode.slice(0, 8).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attendance & Payment Badges */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {r.attended ? (
                      <span className="rounded-xl border border-brand-cyan/40 bg-brand-cyan/15 px-2.5 py-1 text-xs font-bold text-brand-cyan flex items-center gap-1 shadow-sm">
                        <span>✓</span> Присутній
                      </span>
                    ) : (
                      <span className="rounded-xl border border-border bg-surface px-2.5 py-1 text-xs font-medium text-subtle">
                        Очікується
                      </span>
                    )}

                    {r.paymentStatus === 'CONFIRMED' ? (
                      <span className="rounded-xl border border-brand-green/40 bg-brand-green/15 px-2.5 py-1 text-xs font-bold text-brand-green">
                        ✓ Оплату підтверджено
                      </span>
                    ) : r.paymentStatus === 'REJECTED' ? (
                      <span className="rounded-xl border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">
                        ✕ Відхилено
                      </span>
                    ) : isPending ? (
                      <span className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 animate-pulse">
                        ⏳ Очікує перевірки
                      </span>
                    ) : (
                      <span className="rounded-xl border border-border bg-surface px-2.5 py-1 text-xs font-bold text-muted">
                        {PAYMENT_LABEL[r.payment]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rejection reason notice */}
                {r.paymentStatus === 'REJECTED' && r.paymentRejectionReason && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
                    Причина відхилення: {r.paymentRejectionReason}
                  </div>
                )}

                {/* Moderation Action Box (for pending payments) */}
                {isPending && (
                  <div className="rounded-xl border border-amber-500/30 bg-surface/80 p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                      <span>Оплата потребує верифікації адміністратором:</span>
                      {receipt && (
                        <button
                          type="button"
                          onClick={() => openReceiptModal(r)}
                          className="text-brand-cyan hover:underline inline-flex items-center gap-1 font-semibold text-xs transition-colors"
                        >
                          <span>{isPdf ? '📄 Відкрити PDF квитанцію' : '🖼️ Переглянути скриншот'}</span>
                          <span className="text-[10px] bg-brand-cyan/20 px-1 py-0.5 rounded font-mono">🔍</span>
                        </button>
                      )}
                    </div>

                    {/* Inline screenshot preview right in the card */}
                    {receipt && !isPdf && (
                      <div
                        onClick={() => openReceiptModal(r)}
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-border bg-black/40 max-h-48 flex items-center justify-center transition-all hover:border-brand-cyan/60"
                        title="Натисніть для перегляду чека на весь екран"
                      >
                        <img
                          src={receipt}
                          alt={`Чек - ${r.fullName}`}
                          className="max-h-48 w-full object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs font-bold text-white backdrop-blur-[2px]">
                          <span>🔍 Відкрити скриншот на весь екран</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        onClick={() => confirmMutation.mutate(r.id)}
                        disabled={confirmMutation.isPending}
                        className="flex-1 py-1.5 text-xs font-bold bg-brand-green text-black hover:bg-brand-green/90"
                      >
                        ✓ Підтвердити і надіслати квиток
                      </Button>
                      <button
                        type="button"
                        onClick={() =>
                          setRejectModal({
                            open: true,
                            regId: r.id,
                            fullName: r.fullName,
                            reason: '',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-bold transition-colors"
                      >
                        ✕ Відхилити
                      </button>
                    </div>
                  </div>
                )}

                {/* Additional Info: Birth date, Reg date, Receipt link, Cancel button */}
                <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs text-subtle flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span>🎂 {fmtDate(r.birthDate)}</span>
                    <span>🕒 {fmtDateTime(r.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {receipt && !isPending && (
                      <button
                        type="button"
                        onClick={() => openReceiptModal(r)}
                        className="text-brand-cyan hover:underline font-semibold flex items-center gap-1 text-xs transition-colors"
                      >
                        <span>{isPdf ? '📄 Квитанція (PDF)' : '🧾 Чек'}</span>
                        <span className="text-[10px] opacity-70">🔍</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setCancelModal({
                          open: true,
                          regId: r.id,
                          fullName: r.fullName,
                          reason: '',
                        })
                      }
                      className="rounded-lg border border-red-500/30 bg-red-500/5 px-2 py-0.5 text-[11px] font-bold text-red-400 hover:bg-red-500/15 hover:border-red-500/60 transition-colors inline-flex items-center gap-1"
                      title="Скасувати реєстрацію учасника"
                    >
                      <span>🗑️ Скасувати</span>
                    </button>
                  </div>
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
        /* ================= TABLE VIEW ================= */
        <div className="overflow-x-auto rounded-2xl border border-border bg-bg-soft shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50 text-xs font-bold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">ПІБ</th>
                <th className="px-4 py-3.5">Група</th>
                <th className="px-4 py-3.5">Telegram</th>
                <th className="px-4 py-3.5">Джерело</th>
                <th className="px-4 py-3.5">Присутність</th>
                <th className="px-4 py-3.5">Оплата / Статус</th>
                <th className="px-4 py-3.5">Квитанція</th>
                <th className="px-4 py-3.5">Дії</th>
                <th className="px-4 py-3.5">Дата реєстрації</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((r, i) => {
                const receipt = mediaUrl(r.receiptUrl);
                const isPdf = r.receiptUrl?.toLowerCase().endsWith('.pdf');
                const isPending =
                  r.paymentStatus === 'PENDING' ||
                  (r.payment === 'DONATED' && !r.paymentStatus);

                return (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-surface/40 align-middle"
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
                      {r.source === 'WEB' ? (
                        <span className="rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 px-2 py-0.5 text-xs font-bold text-brand-cyan">
                          🌐 Сайт
                        </span>
                      ) : (
                        <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-bold text-muted">
                          🤖 Бот
                        </span>
                      )}
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
                      {r.paymentStatus === 'CONFIRMED' ? (
                        <span className="rounded-xl border border-brand-green/40 bg-brand-green/15 px-2.5 py-1 text-xs font-bold text-brand-green">
                          ✓ Підтверджено
                        </span>
                      ) : r.paymentStatus === 'REJECTED' ? (
                        <span className="rounded-xl border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">
                          ✕ Відхилено
                        </span>
                      ) : isPending ? (
                        <span className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300">
                          ⏳ На перевірці
                        </span>
                      ) : (
                        <span className="rounded-xl border border-border bg-surface px-2.5 py-1 text-xs font-bold text-muted">
                          {PAYMENT_LABEL[r.payment]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {receipt ? (
                        <button
                          type="button"
                          onClick={() => openReceiptModal(r)}
                          className="rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 px-2.5 py-1 text-xs font-bold text-brand-cyan hover:bg-brand-cyan/20 inline-flex items-center gap-1 transition-colors"
                          title="Переглянути скриншот/чек прямо тут"
                        >
                          <span>{isPdf ? '📄 PDF' : '🖼️ Чек'}</span>
                          <span className="text-[10px] opacity-70">🔍</span>
                        </button>
                      ) : (
                        <span className="text-subtle text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => confirmMutation.mutate(r.id)}
                              disabled={confirmMutation.isPending}
                              className="px-2.5 py-1 rounded-lg bg-brand-green text-black hover:bg-brand-green/90 text-xs font-black shadow-sm"
                              title="Підтвердити оплату та надіслати квиток"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setRejectModal({
                                  open: true,
                                  regId: r.id,
                                  fullName: r.fullName,
                                  reason: '',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/15 text-xs font-black"
                              title="Відхилити оплату"
                            >
                              ✕
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setCancelModal({
                              open: true,
                              regId: r.id,
                              fullName: r.fullName,
                              reason: '',
                            })
                          }
                          className="px-2 py-1 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 text-xs font-bold transition-colors"
                          title="Скасувати реєстрацію учасника"
                        >
                          🗑️
                        </button>
                      </div>
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

      {/* Reject Payment Confirmation Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-fg">Відхилити оплату</h3>
              <button
                type="button"
                onClick={() =>
                  setRejectModal({ open: false, regId: null, fullName: '', reason: '' })
                }
                className="text-muted hover:text-fg text-xs p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Ви збираєтесь відхилити оплату для учасника{' '}
              <b className="text-fg">{rejectModal.fullName}</b>. Користувач отримає сповіщення
              в Telegram з проханням звʼязатися з організаторами.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg">
                Причина відхилення (буде надіслана учаснику):
              </label>
              <input
                type="text"
                value={rejectModal.reason}
                onChange={(e) =>
                  setRejectModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Наприклад: Кошти не надійшли на банку / Нечіткий чек"
                className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-xs text-fg placeholder:text-subtle outline-none transition-colors focus:border-brand-cyan"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() =>
                  setRejectModal({ open: false, regId: null, fullName: '', reason: '' })
                }
              >
                Скасувати
              </Button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={() => {
                  if (rejectModal.regId) {
                    rejectMutation.mutate({
                      registrationId: rejectModal.regId,
                      reason: rejectModal.reason.trim() || undefined,
                    });
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-colors disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Відхилення…' : 'Відхилити оплату'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Registration Confirmation Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-surface p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🗑️</span>
                <h3 className="text-base font-black text-fg">Скасувати реєстрацію</h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCancelModal({ open: false, regId: null, fullName: '', reason: '' })
                }
                className="text-muted hover:text-fg text-xs p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Ви впевнені, що хочете видалити реєстрацію для{' '}
              <b className="text-fg">{cancelModal.fullName}</b>? Квиток учасника буде анульовано, а йому в Telegram надійде сповіщення про скасування.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-fg">
                Причина скасування (буде надіслана учаснику, необовʼязково):
              </label>
              <input
                type="text"
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Наприклад: Прохання учасника / Недотримання правил"
                className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-xs text-fg placeholder:text-subtle outline-none transition-colors focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() =>
                  setCancelModal({ open: false, regId: null, fullName: '', reason: '' })
                }
              >
                Назад
              </Button>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (cancelModal.regId) {
                    cancelMutation.mutate({
                      registrationId: cancelModal.regId,
                      reason: cancelModal.reason.trim() || undefined,
                    });
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-colors disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Скасування…' : 'Підтвердити видалення'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Receipt / Screenshot Preview Lightbox Modal */}
      {receiptModal.open && receiptModal.receiptUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setReceiptModal((prev) => ({ ...prev, open: false }));
            }
          }}
        >
          <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-surface/90 px-5 py-3.5 shrink-0">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-brand-cyan">
                    🧾 Перевірка оплати
                  </span>
                  <span className="rounded-lg bg-surface border border-border px-2 py-0.5 text-xs font-mono font-bold text-brand-cyan">
                    {receiptModal.group}
                  </span>
                  <a
                    href={`https://t.me/${receiptModal.telegramTag.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-cyan hover:underline font-medium"
                  >
                    {receiptModal.telegramTag}
                  </a>
                </div>
                <h3 className="text-base font-black text-fg truncate mt-0.5">
                  {receiptModal.fullName}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={mediaUrl(receiptModal.receiptUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-border bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-brand-cyan hover:bg-white/10 transition-colors inline-flex items-center gap-1"
                  title="Відкрити оригінал у новій вкладці"
                >
                  <span>↗ Нова вкладка</span>
                </a>
                <button
                  type="button"
                  onClick={() => setReceiptModal((prev) => ({ ...prev, open: false }))}
                  className="rounded-xl border border-border bg-white/5 p-2 text-muted hover:text-fg hover:bg-white/10 text-xs transition-colors"
                  title="Закрити"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Preview Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60 min-h-[300px]">
              {receiptModal.receiptIsPdf ? (
                <iframe
                  src={mediaUrl(receiptModal.receiptUrl)}
                  title={`Квитанція - ${receiptModal.fullName}`}
                  className="w-full h-[65vh] rounded-2xl border border-border bg-white"
                />
              ) : (
                <img
                  src={mediaUrl(receiptModal.receiptUrl)}
                  alt={`Чек - ${receiptModal.fullName}`}
                  className="max-h-[65vh] max-w-full object-contain rounded-2xl shadow-xl border border-white/10"
                />
              )}
            </div>

            {/* Modal Footer / Actions */}
            <div className="border-t border-border bg-surface px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 flex-wrap">
              <div className="text-xs">
                {receiptModal.paymentStatus === 'CONFIRMED' ? (
                  <span className="font-bold text-brand-green flex items-center gap-1">
                    <span>✓</span> Оплату підтверджено
                  </span>
                ) : receiptModal.paymentStatus === 'REJECTED' ? (
                  <span className="font-bold text-red-400 flex items-center gap-1">
                    <span>✕</span> Оплату відхилено
                  </span>
                ) : (
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    <span>⏳</span> Очікує верифікації
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(receiptModal.paymentStatus === 'PENDING' ||
                  (receiptModal.payment === 'DONATED' && receiptModal.paymentStatus !== 'CONFIRMED')) && (
                  <>
                    <Button
                      onClick={() => {
                        if (receiptModal.regId) {
                          confirmMutation.mutate(receiptModal.regId);
                          setReceiptModal((prev) => ({
                            ...prev,
                            paymentStatus: 'CONFIRMED',
                            open: false,
                          }));
                        }
                      }}
                      disabled={confirmMutation.isPending}
                      className="py-2 px-4 text-xs font-bold bg-brand-green text-black hover:bg-brand-green/90 shadow-sm"
                    >
                      ✓ Підтвердити оплату
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        const { regId, fullName } = receiptModal;
                        setReceiptModal((prev) => ({ ...prev, open: false }));
                        setRejectModal({
                          open: true,
                          regId,
                          fullName,
                          reason: '',
                        });
                      }}
                      className="px-3.5 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-bold transition-colors"
                    >
                      ✕ Відхилити
                    </button>
                  </>
                )}
                <Button
                  variant="outline"
                  className="text-xs"
                  onClick={() => setReceiptModal((prev) => ({ ...prev, open: false }))}
                >
                  Закрити
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
