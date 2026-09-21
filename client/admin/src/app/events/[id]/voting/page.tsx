'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mediaUrl, type EventVoting, type VotingCandidate, type VotingStatus } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ImageUpload } from '@/components/ImageUpload';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError } from '@/components/ui/FormError';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

export default function EventVotingPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.event(eventId),
  });

  const { data: votings, isLoading } = useQuery({
    queryKey: ['event-votings', eventId],
    queryFn: () => api.eventVotings(eventId),
  });

  // State for creating a nomination
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [onlyRegistered, setOnlyRegistered] = useState(true);
  const [showResultsLive, setShowResultsLive] = useState(false);
  const [allowChangeVote, setAllowChangeVote] = useState(false);
  const [allowSubmissions, setAllowSubmissions] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);

  // State for candidate addition & editing
  const [candidateVotingId, setCandidateVotingId] = useState<string | null>(null);
  const [candName, setCandName] = useState('');
  const [candDesc, setCandDesc] = useState('');
  const [candPhoto, setCandPhoto] = useState<string | null>(null);

  const [editingCandidate, setEditingCandidate] = useState<{
    id: string;
    name: string;
    description: string;
    photoUrl: string | null;
  } | null>(null);

  // State for notification confirm
  const [notifyVotingId, setNotifyVotingId] = useState<string | null>(null);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  // State for results drawer/view
  const [activeResultsId, setActiveResultsId] = useState<string | null>(null);
  const [downloadingVotingId, setDownloadingVotingId] = useState<string | null>(null);

  // State for participant submissions moderation drawer
  const [moderationVotingId, setModerationVotingId] = useState<string | null>(null);
  const [submissionFilter, setSubmissionFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    candidateId: string | null;
    candidateName: string;
    reason: string;
  }>({ open: false, candidateId: null, candidateName: '', reason: '' });
  const [copiedScreenId, setCopiedScreenId] = useState<string | null>(null);

  const { data: resultsData, isLoading: isResultsLoading } = useQuery({
    queryKey: ['voting-results', activeResultsId],
    queryFn: () => (activeResultsId ? api.votingResults(activeResultsId) : null),
    enabled: !!activeResultsId,
  });

  const { data: submissionsData, isLoading: isSubmissionsLoading } = useQuery({
    queryKey: ['voting-submissions', moderationVotingId],
    queryFn: () => (moderationVotingId ? api.votingSubmissions(moderationVotingId) : null),
    enabled: !!moderationVotingId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createVoting(eventId, {
        title: title.trim(),
        description: description.trim() || undefined,
        onlyRegistered,
        showResultsLive,
        allowChangeVote,
        allowSubmissions,
        submissionsOpen: allowSubmissions ? submissionsOpen : false,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      hapticNotify('success');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setAllowChangeVote(false);
      setAllowSubmissions(false);
      setSubmissionsOpen(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ votingId, status }: { votingId: string; status: VotingStatus }) =>
      api.updateVoting(votingId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      hapticNotify('success');
    },
  });

  const toggleSubmissionsMutation = useMutation({
    mutationFn: ({ votingId, open }: { votingId: string; open: boolean }) =>
      api.updateVoting(votingId, { submissionsOpen: open }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      hapticNotify('success');
    },
  });

  const approveSubmissionMutation = useMutation({
    mutationFn: (candidateId: string) => api.approveSubmission(candidateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      if (moderationVotingId) {
        qc.invalidateQueries({ queryKey: ['voting-submissions', moderationVotingId] });
      }
      hapticNotify('success');
    },
  });

  const rejectSubmissionMutation = useMutation({
    mutationFn: ({ candidateId, reason }: { candidateId: string; reason?: string }) =>
      api.rejectSubmission(candidateId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      if (moderationVotingId) {
        qc.invalidateQueries({ queryKey: ['voting-submissions', moderationVotingId] });
      }
      hapticNotify('success');
      setRejectModal({ open: false, candidateId: null, candidateName: '', reason: '' });
    },
  });

  const addCandidateMutation = useMutation({
    mutationFn: () => {
      if (!candidateVotingId) throw new Error('No voting selected');
      return api.addCandidate(candidateVotingId, {
        name: candName.trim(),
        description: candDesc.trim() || undefined,
        photoUrl: candPhoto ?? undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      hapticNotify('success');
      setCandidateVotingId(null);
      setCandName('');
      setCandDesc('');
      setCandPhoto(null);
    },
  });

  const updateCandidateMutation = useMutation({
    mutationFn: () => {
      if (!editingCandidate) throw new Error('No candidate selected');
      return api.updateCandidate(editingCandidate.id, {
        name: editingCandidate.name.trim(),
        description: editingCandidate.description.trim() || undefined,
        photoUrl: editingCandidate.photoUrl ?? undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      hapticNotify('success');
      setEditingCandidate(null);
    },
  });

  const handleDownloadVotingExcel = async (vId: string, vTitle: string) => {
    try {
      setDownloadingVotingId(vId);
      const blob = await api.exportVotingResultsBlob(vId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voting-${vTitle.slice(0, 30)}-results.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не вдалося експортувати Excel');
    } finally {
      setDownloadingVotingId(null);
    }
  };

  const deleteCandidateMutation = useMutation({
    mutationFn: (candId: string) => api.deleteCandidate(candId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      hapticNotify('success');
    },
  });

  const deleteVotingMutation = useMutation({
    mutationFn: (vId: string) => api.deleteVoting(vId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', eventId] });
      hapticNotify('success');
    },
  });

  const notifyMutation = useMutation({
    mutationFn: (vId: string) => api.notifyVotingStarted(vId),
    onSuccess: (res) => {
      setNotifyVotingId(null);
      hapticNotify('success');
      setNotifyMsg(`Сповіщення надіслано ${res.sentCount} зареєстрованим учасникам!`);
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader
        title={event?.name ? `Голосування: ${event.name}` : 'Голосування заходу'}
        backHref={`/events/${eventId}`}
      />

      {notifyMsg ? (
        <div className="mb-4 rounded-xl border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-green">
          {notifyMsg}
        </div>
      ) : null}

      <div className="mb-6 flex justify-between items-center">
        <div className="text-sm font-semibold text-muted">
          Номінацій: {votings?.length ?? 0}
        </div>
        <Button onClick={() => setCreateOpen(true)} className="px-3 py-1.5 text-xs">
          + Створити номінацію
        </Button>
      </div>

      {createOpen ? (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4 space-y-3">
          <h3 className="font-bold text-fg">Нова номінація для голосування</h3>
          <Input
            label="Назва номінації"
            placeholder="Наприклад: Найкращий костюм"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Textarea
            label="Опис (опціонально)"
            placeholder="Поясніть умови чи правила вибору..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyRegistered}
                onChange={(e) => setOnlyRegistered(e.target.checked)}
                className="h-4 w-4 rounded accent-brand-cyan"
              />
              <span>Голосувати можуть тільки зареєстровані учасники заходу</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showResultsLive}
                onChange={(e) => setShowResultsLive(e.target.checked)}
                className="h-4 w-4 rounded accent-brand-cyan"
              />
              <span>Показувати результати відразу після голосу</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowChangeVote}
                onChange={(e) => setAllowChangeVote(e.target.checked)}
                className="h-4 w-4 rounded accent-brand-cyan"
              />
              <span>Дозволити змінювати свій голос до закриття голосування</span>
            </label>

            <div className="pt-2 border-t border-border space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-brand-cyan">
                <input
                  type="checkbox"
                  checked={allowSubmissions}
                  onChange={(e) => {
                    setAllowSubmissions(e.target.checked);
                    if (!e.target.checked) setSubmissionsOpen(false);
                  }}
                  className="h-4 w-4 rounded accent-brand-cyan"
                />
                <span>Дозволити учасникам самостійно подавати заявки (конкурс костюмів)</span>
              </label>

              {allowSubmissions && (
                <label className="flex items-center gap-2 text-sm pl-6 text-muted">
                  <input
                    type="checkbox"
                    checked={submissionsOpen}
                    onChange={(e) => setSubmissionsOpen(e.target.checked)}
                    className="h-4 w-4 rounded accent-brand-green"
                  />
                  <span>Одразу відкрити прийом фото від учасників</span>
                </label>
              )}
            </div>
          </div>
          {createMutation.error ? <FormError error={createMutation.error} /> : null}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCreateOpen(false)}
            >
              Скасувати
            </Button>
            <Button
              className="flex-1"
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Створення…' : 'Створити'}
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (votings ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted text-sm">
          Для цього заходу ще немає жодного голосування. Натисніть «+ Створити номінацію» вище, щоб додати.
        </div>
      ) : (
        <div className="space-y-6">
          {votings?.map((v) => (
            <div
              key={v.id}
              className="rounded-2xl border border-border bg-surface p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-lg text-fg">{v.title}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        v.status === 'ACTIVE'
                          ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                          : v.status === 'CLOSED'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-white/10 text-muted border border-white/10'
                      }`}
                    >
                      {v.status === 'ACTIVE'
                        ? 'Активне'
                        : v.status === 'CLOSED'
                        ? 'Завершено'
                        : 'Чернетка'}
                    </span>
                  </div>
                  {v.description && (
                    <p className="mt-1 text-xs text-muted">{v.description}</p>
                  )}
                  <div className="mt-2 text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
                    <span>Голосів: <b className="text-brand-cyan">{v.totalVotes}</b></span>
                    <span>Кандидатів: <b className="text-fg">{v.candidates.length}</b></span>
                    <span>{v.onlyRegistered ? 'Тільки для зареєстрованих' : 'Для всіх'}</span>
                    <span>{v.allowChangeVote ? 'Зміна голосу: так' : 'Зміна голосу: ні'}</span>
                    {v.allowSubmissions && (
                      <span className="text-brand-cyan font-semibold">
                        Заявки: {v.submissionsOpen ? 'прийом відкрито' : 'прийом закрито'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Видалити цю номінацію?')) {
                      deleteVotingMutation.mutate(v.id);
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Видалити
                </button>
              </div>

              {/* Status toggles */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                <span className="text-xs text-muted font-bold">Статус голосування:</span>
                <button
                  onClick={() =>
                    updateStatusMutation.mutate({ votingId: v.id, status: 'DRAFT' })
                  }
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                    v.status === 'DRAFT'
                      ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan'
                      : 'border-border text-muted hover:border-white/30'
                  }`}
                >
                  Чернетка
                </button>
                <button
                  onClick={() =>
                    updateStatusMutation.mutate({ votingId: v.id, status: 'ACTIVE' })
                  }
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                    v.status === 'ACTIVE'
                      ? 'border-brand-green bg-brand-green/10 text-brand-green'
                      : 'border-border text-muted hover:border-white/30'
                  }`}
                >
                  Відкрити
                </button>
                <button
                  onClick={() =>
                    updateStatusMutation.mutate({ votingId: v.id, status: 'CLOSED' })
                  }
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                    v.status === 'CLOSED'
                      ? 'border-red-500 bg-red-500/10 text-red-400'
                      : 'border-border text-muted hover:border-white/30'
                  }`}
                >
                  Завершити
                </button>
              </div>

              {/* Broadcast Action Bar */}
              {v.status === 'ACTIVE' && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 px-3 py-2">
                  <span className="text-xs text-brand-green font-medium">
                    Голосування відкрите для учасників
                  </span>
                  <Button
                    variant="outline"
                    className="text-xs px-3 py-1 border-brand-green/40 text-brand-green hover:bg-brand-green/20"
                    onClick={() => setNotifyVotingId(v.id)}
                  >
                    Оголосити старт (розсилка)
                  </Button>
                </div>
              )}

              {/* Candidates section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Кандидати ({v.candidates.length})
                  </span>
                  <button
                    onClick={() => setCandidateVotingId(v.id)}
                    className="text-xs font-semibold text-brand-cyan hover:underline"
                  >
                    + Додати кандидата
                  </button>
                </div>

                {v.candidates.length === 0 ? (
                  <div className="text-xs text-muted py-2 italic">
                    Ще немає кандидатів
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {v.candidates.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-bg/50 p-2.5"
                      >
                        {c.photoUrl ? (
                          <img
                            src={mediaUrl(c.photoUrl)}
                            alt={c.name}
                            className="h-10 w-10 rounded-lg object-cover border border-white/10"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-surface flex items-center justify-center text-[11px] font-bold text-muted border border-border">
                            #{idx + 1}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-fg truncate">
                              {c.name}
                            </span>
                            {c.status === 'PENDING' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                На розгляді
                              </span>
                            )}
                            {c.status === 'REJECTED' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                                Відхилено
                              </span>
                            )}
                            {c.submittedByTag && (
                              <span className="text-[10px] text-brand-cyan">
                                {c.submittedByTag}
                              </span>
                            )}
                          </div>
                          {c.description && (
                            <div className="text-[10px] text-muted truncate">
                              {c.description}
                            </div>
                          )}
                          <div className="text-[10px] text-brand-cyan">
                            Голосів: {c.votesCount ?? 0}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingCandidate({
                                id: c.id,
                                name: c.name,
                                description: c.description ?? '',
                                photoUrl: c.photoUrl,
                              })
                            }
                            className="text-[11px] font-medium text-brand-cyan hover:underline px-1.5 py-0.5 rounded bg-surface border border-border"
                          >
                            Редагувати
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Видалити кандидата ${c.name}?`)) {
                                deleteCandidateMutation.mutate(c.id);
                              }
                            }}
                            className="text-[11px] text-red-400 hover:text-red-300 px-1"
                            title="Видалити"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submissions Moderation Button & Panel (for costume contests) */}
              {v.allowSubmissions && (
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-fg">Прийом заявок:</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${
                          v.submissionsOpen
                            ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                            : 'bg-white/10 text-muted border border-border'
                        }`}
                      >
                        {v.submissionsOpen ? 'ВІДКРИТО' : 'ЗАКРИТО'}
                      </span>
                      <button
                        onClick={() =>
                          toggleSubmissionsMutation.mutate({
                            votingId: v.id,
                            open: !v.submissionsOpen,
                          })
                        }
                        className="text-xs px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface/80 text-fg"
                      >
                        {v.submissionsOpen ? 'Призупинити' : 'Відкрити прийом'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/events/${eventId}/broadcast?template=costume_contest&votingId=${v.id}`}
                        className="text-xs px-2.5 py-1 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 font-medium"
                      >
                        Швидка розсилка про конкурс
                      </Link>
                      <Button
                        variant="outline"
                        className="text-xs px-3 py-1"
                        onClick={() =>
                          setModerationVotingId(moderationVotingId === v.id ? null : v.id)
                        }
                      >
                        {moderationVotingId === v.id ? 'Сховати заявки' : 'Модерація заявок'}
                        {(v.pendingSubmissionsCount ?? 0) > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                            {v.pendingSubmissionsCount}
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Moderation section */}
                  {moderationVotingId === v.id && (
                    <div className="rounded-xl border border-border bg-bg/70 p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted">
                          Заявки на конкурс
                        </div>
                        <div className="flex gap-1">
                          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                            <button
                              key={filter}
                              onClick={() => setSubmissionFilter(filter)}
                              className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                                submissionFilter === filter
                                  ? 'border-brand-cyan bg-brand-cyan/20 text-brand-cyan'
                                  : 'border-border text-muted hover:text-fg'
                              }`}
                            >
                              {filter === 'ALL'
                                ? `Всі (${submissionsData?.length ?? 0})`
                                : filter === 'PENDING'
                                ? `Очікують (${submissionsData?.filter((s) => s.status === 'PENDING').length ?? 0})`
                                : filter === 'APPROVED'
                                ? `Схвалені (${submissionsData?.filter((s) => s.status === 'APPROVED').length ?? 0})`
                                : `Відхилені (${submissionsData?.filter((s) => s.status === 'REJECTED').length ?? 0})`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {isSubmissionsLoading ? (
                        <div className="flex justify-center py-4">
                          <Spinner />
                        </div>
                      ) : !submissionsData || submissionsData.length === 0 ? (
                        <div className="text-xs text-muted py-4 text-center">
                          Учасники ще не подавали заявок на цей конкурс
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {submissionsData
                            .filter((sub) =>
                              submissionFilter === 'ALL' ? true : sub.status === submissionFilter,
                            )
                            .map((sub) => (
                              <div
                                key={sub.id}
                                className="rounded-xl border border-border bg-surface p-3 flex flex-col sm:flex-row gap-3 items-start justify-between"
                              >
                                <div className="flex gap-3">
                                  {sub.photoUrl ? (
                                    <a
                                      href={mediaUrl(sub.photoUrl)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0 group relative block"
                                    >
                                      <img
                                        src={mediaUrl(sub.photoUrl)}
                                        alt={sub.name}
                                        className="h-16 w-16 rounded-xl object-cover border border-white/10 group-hover:opacity-80 transition-opacity"
                                      />
                                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-xl text-[10px] text-white">
                                        🔍
                                      </span>
                                    </a>
                                  ) : (
                                    <div className="h-16 w-16 rounded-xl bg-bg flex items-center justify-center text-xs text-muted border border-border shrink-0">
                                      Без фото
                                    </div>
                                  )}

                                  <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-fg">{sub.name}</span>
                                      <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                          sub.status === 'PENDING'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : sub.status === 'APPROVED'
                                            ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        }`}
                                      >
                                        {sub.status === 'PENDING'
                                          ? 'Очікує'
                                          : sub.status === 'APPROVED'
                                          ? 'Схвалено'
                                          : 'Відхилено'}
                                      </span>
                                    </div>

                                    {sub.description && (
                                      <p className="text-xs text-muted break-words line-clamp-2">
                                        {sub.description}
                                      </p>
                                    )}

                                    <div className="text-[11px] text-muted flex flex-wrap gap-x-2">
                                      <span>
                                        Від:{' '}
                                        <b className="text-fg">
                                          {sub.submittedByName || 'Учасник'}
                                        </b>
                                      </span>
                                      {sub.submittedByTag && (
                                        <span className="text-brand-cyan">{sub.submittedByTag}</span>
                                      )}
                                      {sub.createdAt && (
                                        <span>
                                          {new Date(sub.createdAt).toLocaleDateString('uk-UA', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      )}
                                    </div>

                                    {sub.rejectionReason && (
                                      <div className="text-[11px] text-red-400 bg-red-500/10 p-1.5 rounded border border-red-500/20">
                                        Причина відхилення: {sub.rejectionReason}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex sm:flex-col gap-1.5 shrink-0 self-end sm:self-center w-full sm:w-auto">
                                  {sub.status !== 'APPROVED' && (
                                    <Button
                                      variant="primary"
                                      className="text-xs px-3 py-1 flex-1 sm:flex-none bg-brand-green hover:bg-brand-green/80 text-black font-semibold"
                                      onClick={() => approveSubmissionMutation.mutate(sub.id)}
                                      disabled={approveSubmissionMutation.isPending}
                                    >
                                      ✓ Схвалити
                                    </Button>
                                  )}

                                  {sub.status !== 'REJECTED' && (
                                    <Button
                                      variant="outline"
                                      className="text-xs px-3 py-1 flex-1 sm:flex-none text-red-400 border-red-500/40 hover:bg-red-500/10"
                                      onClick={() =>
                                        setRejectModal({
                                          open: true,
                                          candidateId: sub.id,
                                          candidateName: sub.name,
                                          reason: '',
                                        })
                                      }
                                    >
                                      ✕ Відхилити
                                    </Button>
                                  )}

                                  <button
                                    onClick={() => {
                                      if (confirm(`Видалити заявку "${sub.name}"?`)) {
                                        deleteCandidateMutation.mutate(sub.id);
                                      }
                                    }}
                                    className="text-[10px] text-muted hover:text-red-400 self-center sm:self-end pt-1"
                                  >
                                    Видалити
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Results & Stage Screen buttons */}
              <div className="pt-2 border-t border-border flex flex-wrap justify-between items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="text-xs px-3 py-1"
                    onClick={() =>
                      setActiveResultsId(activeResultsId === v.id ? null : v.id)
                    }
                  >
                    {activeResultsId === v.id ? 'Сховати результати' : 'Результати та голоси'}
                  </Button>

                  <a
                    href={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3002/screen/voting/${v.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2.5 py-1 rounded-lg border border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 font-medium flex items-center transition-colors"
                  >
                    Екран для сцени
                  </a>

                  <button
                    onClick={() => {
                      const screenUrl = `${window.location.protocol}//${window.location.hostname}:3002/screen/voting/${v.id}`;
                      navigator.clipboard.writeText(screenUrl);
                      hapticNotify('success');
                      setCopiedScreenId(v.id);
                      setTimeout(() => setCopiedScreenId(null), 2500);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg border border-border bg-surface text-muted hover:text-fg hover:border-white/30 font-medium"
                    title="Скопіювати пряме посилання на екран"
                  >
                    {copiedScreenId === v.id ? 'Скопійовано!' : 'Скопіювати посилання'}
                  </button>
                </div>

                {activeResultsId === v.id && (
                  <button
                    type="button"
                    disabled={downloadingVotingId === v.id}
                    onClick={() => handleDownloadVotingExcel(v.id, v.title)}
                    className="text-xs font-semibold text-brand-green hover:underline"
                  >
                    {downloadingVotingId === v.id ? 'Завантаження…' : 'Завантажити Excel'}
                  </button>
                )}
              </div>

              {/* Live Results view */}
              {activeResultsId === v.id && (
                <div className="mt-3 rounded-xl border border-border bg-bg/60 p-3 space-y-3">
                  {isResultsLoading ? (
                    <div className="flex justify-center py-4">
                      <Spinner />
                    </div>
                  ) : (
                    <>
                      <div className="text-xs font-bold uppercase text-muted">
                        Розподіл голосів
                      </div>
                      <div className="space-y-2">
                        {resultsData?.candidates.map((c) => (
                          <div key={c.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-fg">{c.name}</span>
                              <span className="text-muted">
                                {c.votesCount} ({c.percentage}%)
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                              <div
                                className="h-full bg-brand-cyan rounded-full transition-all duration-300"
                                style={{ width: `${c.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-border">
                        <div className="text-xs font-bold uppercase text-muted mb-2">
                          Останні голоси ({resultsData?.votes.length ?? 0})
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                          {resultsData?.votes.map((vt) => (
                            <div
                              key={vt.id}
                              className="flex justify-between items-center py-1 border-b border-border/50 text-muted"
                            >
                              <div>
                                <span className="font-semibold text-fg">
                                  {vt.voterName}
                                </span>{' '}
                                {vt.telegramTag && (
                                  <span className="text-brand-cyan">
                                    ({vt.telegramTag})
                                  </span>
                                )}
                                {vt.group && (
                                  <span className="text-[10px] ml-1">[{vt.group}]</span>
                                )}
                              </div>
                              <span className="text-fg font-medium">
                                → {vt.candidateName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Candidate Modal */}
      {candidateVotingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 space-y-3">
            <h3 className="font-bold text-fg">Додати кандидата</h3>
            <Input
              label="Імʼя / Назва"
              placeholder="Наприклад: Олексій — Франкенштейн"
              value={candName}
              onChange={(e) => setCandName(e.target.value)}
              required
            />
            <Input
              label="Опис (опціонально)"
              placeholder="Короткий опис чи номер виступу"
              value={candDesc}
              onChange={(e) => setCandDesc(e.target.value)}
            />
            <div>
              <label className="mb-1 block text-sm font-semibold">
                Фото кандидата (опціонально)
              </label>
              <ImageUpload value={candPhoto} onChange={setCandPhoto} />
            </div>
            {addCandidateMutation.error && (
              <FormError error={addCandidateMutation.error} />
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCandidateVotingId(null)}
              >
                Скасувати
              </Button>
              <Button
                className="flex-1"
                disabled={!candName.trim() || addCandidateMutation.isPending}
                onClick={() => addCandidateMutation.mutate()}
              >
                {addCandidateMutation.isPending ? 'Додавання…' : 'Додати'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Confirm Dialog */}
      <ConfirmDialog
        open={!!notifyVotingId}
        title="Оголосити початок голосування"
        message="Надіслати всім зареєстрованим учасникам заходу розсилку в Telegram про те, що голосування розпочато?"
        confirmLabel="Розіслати"
        loading={notifyMutation.isPending}
        error={notifyMutation.error}
        onConfirm={() => notifyVotingId && notifyMutation.mutate(notifyVotingId)}
        onCancel={() => setNotifyVotingId(null)}
      />

      {/* Reject Submission Reason Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 space-y-3">
            <h3 className="font-bold text-fg">Відхилити заявку</h3>
            <p className="text-xs text-muted">
              Ви збираєтесь відхилити заявку «{rejectModal.candidateName}». Вона не потрапить до списку голосування.
            </p>
            <Input
              label="Причина відхилення (опціонально)"
              placeholder="Наприклад: Не відповідає темі заходу або низька якість фото"
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal((prev) => ({ ...prev, reason: e.target.value }))
              }
            />
            {rejectSubmissionMutation.error && (
              <FormError error={rejectSubmissionMutation.error} />
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  setRejectModal({
                    open: false,
                    candidateId: null,
                    candidateName: '',
                    reason: '',
                  })
                }
              >
                Скасувати
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                disabled={rejectSubmissionMutation.isPending}
                onClick={() =>
                  rejectModal.candidateId &&
                  rejectSubmissionMutation.mutate({
                    candidateId: rejectModal.candidateId,
                    reason: rejectModal.reason.trim() || undefined,
                  })
                }
              >
                {rejectSubmissionMutation.isPending ? 'Відхилення…' : 'Відхилити'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 space-y-3">
            <h3 className="font-bold text-fg">Редагувати кандидата</h3>
            <Input
              label="Імʼя / Назва"
              value={editingCandidate.name}
              onChange={(e) =>
                setEditingCandidate((prev) =>
                  prev ? { ...prev, name: e.target.value } : null,
                )
              }
              required
            />
            <Input
              label="Опис (опціонально)"
              value={editingCandidate.description}
              onChange={(e) =>
                setEditingCandidate((prev) =>
                  prev ? { ...prev, description: e.target.value } : null,
                )
              }
            />
            <div>
              <label className="mb-1 block text-sm font-semibold">
                Фото кандидата (опціонально)
              </label>
              <ImageUpload
                value={editingCandidate.photoUrl}
                onChange={(url) =>
                  setEditingCandidate((prev) =>
                    prev ? { ...prev, photoUrl: url } : null,
                  )
                }
              />
            </div>
            {updateCandidateMutation.error && (
              <FormError error={updateCandidateMutation.error} />
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditingCandidate(null)}
              >
                Скасувати
              </Button>
              <Button
                className="flex-1"
                disabled={
                  !editingCandidate.name.trim() || updateCandidateMutation.isPending
                }
                onClick={() => updateCandidateMutation.mutate()}
              >
                {updateCandidateMutation.isPending ? 'Збереження…' : 'Зберегти'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
