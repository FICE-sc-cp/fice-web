'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type BlockedUser, type UpdateBlockedUserInput } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { FormError } from '@/components/ui/FormError';
import { hapticNotify } from '@/lib/telegram';

export default function BlockedUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newFaculty, setNewFaculty] = useState('');
  const [newReason, setNewReason] = useState('');

  // Edit modal state
  const [editUser, setEditUser] = useState<BlockedUser | null>(null);
  const [editGroup, setEditGroup] = useState('');
  const [editFaculty, setEditFaculty] = useState('');
  const [editReason, setEditReason] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['blocked-users', search],
    queryFn: () => api.blockedUsers(search.trim() || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['blocked-users'] });

  const addMutation = useMutation({
    mutationFn: () =>
      api.createBlockedUser({
        telegramTag: newTag.trim().startsWith('@') ? newTag.trim() : `@${newTag.trim()}`,
        group: newGroup.trim() || undefined,
        faculty: newFaculty.trim() || undefined,
        reason: newReason.trim() || 'Заблоковано адміністратором',
        isBlocked: true,
      }),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
      setAddOpen(false);
      setNewTag('');
      setNewGroup('');
      setNewFaculty('');
      setNewReason('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlockedUserInput }) =>
      api.updateBlockedUser(id, data),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
      setEditUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBlockedUser(id),
    onSuccess: () => {
      invalidate();
      hapticNotify('success');
    },
  });

  const handleOpenEdit = (u: BlockedUser) => {
    setEditUser(u);
    setEditGroup(u.group || '');
    setEditFaculty(u.faculty || '');
    setEditReason(u.reason || '');
  };

  const handleSaveEdit = () => {
    if (!editUser) return;
    updateMutation.mutate({
      id: editUser.id,
      data: {
        group: editGroup.trim() || undefined,
        faculty: editFaculty.trim() || undefined,
        reason: editReason.trim() || undefined,
      },
    });
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-6 space-y-6">
      <PageHeader
        title="Заблоковані користувачі"
        backHref="/"
        action={
          <Button
            onClick={() => setAddOpen(true)}
            className="text-xs font-bold px-3 py-1.5"
          >
            + Заблокувати
          </Button>
        }
      />

      <p className="text-xs text-muted leading-relaxed">
        Користувачі, чий Telegram-тег додано сюди, не можуть реєструватися на заходи.
      </p>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук за @тегом, групою, факультетом…"
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

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 space-y-3">
            <h3 className="font-bold text-fg">Заблокувати користувача</h3>
            <Input
              label="Telegram-тег"
              placeholder="@username"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              required
            />
            <Input
              label="Академічна група (опціонально)"
              placeholder="Наприклад: ТВ-21"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
            />
            <Input
              label="Факультет (опціонально)"
              placeholder="Наприклад: ФСП"
              value={newFaculty}
              onChange={(e) => setNewFaculty(e.target.value)}
            />
            <Input
              label="Причина блокування"
              placeholder="Невідповідний факультет"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
            />
            {addMutation.error && <FormError error={addMutation.error} />}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddOpen(false)}
              >
                Скасувати
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold"
                disabled={!newTag.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? 'Збереження…' : 'Заблокувати'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 space-y-3">
            <h3 className="font-bold text-fg">Редагувати користувача</h3>
            <div className="text-xs text-brand-cyan font-mono font-bold">
              {editUser.telegramTag}
            </div>
            <Input
              label="Група"
              value={editGroup}
              onChange={(e) => setEditGroup(e.target.value)}
            />
            <Input
              label="Факультет"
              value={editFaculty}
              onChange={(e) => setEditFaculty(e.target.value)}
            />
            <Input
              label="Причина"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
            />
            {updateMutation.error && <FormError error={updateMutation.error} />}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditUser(null)}
              >
                Скасувати
              </Button>
              <Button
                className="flex-1 font-bold"
                disabled={updateMutation.isPending}
                onClick={handleSaveEdit}
              >
                {updateMutation.isPending ? 'Збереження…' : 'Зберегти'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !users || users.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg-soft py-12 text-center text-subtle text-sm">
          {search ? 'За запитом користувачів не знайдено' : 'Список заблокованих порожній'}
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-border bg-bg-soft p-4 space-y-3 transition-colors hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`https://t.me/${u.telegramTag.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-fg hover:text-brand-cyan hover:underline"
                    >
                      {u.telegramTag} ↗
                    </a>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        u.isBlocked
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                      }`}
                    >
                      {u.isBlocked ? 'Заблоковано' : 'Розблоковано'}
                    </span>
                    {u.group && (
                      <span className="rounded-md bg-surface border border-border px-1.5 py-0.5 text-[11px] font-mono text-brand-cyan">
                        {u.group}
                      </span>
                    )}
                    {u.faculty && (
                      <span className="rounded-md bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 text-[11px] font-bold text-purple-300">
                        {u.faculty}
                      </span>
                    )}
                  </div>
                  {u.reason && (
                    <p className="text-xs text-muted">Причина: {u.reason}</p>
                  )}
                  <div className="text-[10px] text-subtle">
                    Дата блокування:{' '}
                    {new Date(u.blockedAt).toLocaleDateString('uk-UA', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateMutation.mutate({
                        id: u.id,
                        data: { isBlocked: !u.isBlocked },
                      })
                    }
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      u.isBlocked
                        ? 'border-brand-green/40 text-brand-green hover:bg-brand-green/10'
                        : 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                    }`}
                  >
                    {u.isBlocked ? 'Розблокувати' : 'Заблокувати'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(u)}
                    className="text-xs font-semibold text-brand-cyan hover:underline px-2 py-1"
                  >
                    Редагувати
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Видалити запис про ${u.telegramTag}?`)) {
                      deleteMutation.mutate(u.id);
                    }
                  }}
                  className="text-xs text-subtle hover:text-red-400"
                >
                  Видалити
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
