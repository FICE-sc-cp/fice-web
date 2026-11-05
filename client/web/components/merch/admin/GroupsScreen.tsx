'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { AdminGroup } from '@/lib/merch-types';
import { cn } from '@/lib/utils';
import { Banner, CONTROL, DANGER_CLASS, Empty, useAction, useSurface } from '../ui';
import { Gate, ICONS, Icon, LIST_CLASS, ScreenHead, failText, saving, scrollOnFocus, useTwoTap } from './kit';
import { useAdminState } from './useAdminState';

export function GroupsScreen() {
  const { api, toast } = useSurface();
  const { state, error, refresh } = useAdminState();
  const { busy, error: createError, run } = useAction();
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const create = async () => {
    const value = name.trim();
    if (!value) return;
    if (await run(() => saving(api.admin.createGroup(value)))) {
      setName('');
      toast('Групу створено ✓');
      await refresh();
    }
  };

  return (
    <div className="space-y-5">
      <ScreenHead title="Групи користувачів" />
      {!state ? (
        <Gate error={error} refresh={refresh} />
      ) : (
        <>
          {error && <Banner tone="error">{error}</Banner>}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <div className="min-w-0 flex-1">
              <Input
                label="Нова група (напр. Куратори)"
                placeholder="Назва групи"
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={scrollOnFocus}
                enterKeyHint="done"
              />
            </div>
            <Button
              type="submit"
              disabled={busy || !name.trim()}
              className="mb-0.5 shrink-0 rounded-xl py-3"
            >
              {busy ? '...' : '+ Додати'}
            </Button>
          </form>
          {createError && <Banner tone="error">{createError}</Banner>}

          {!state.groups.length ? (
            <Empty
              icon="👥"
              title="Груп ще немає"
              text="Створіть групу, додайте учасників — і зможете робити товари, видимі лише для цієї групи."
            />
          ) : (
            <ul className={LIST_CLASS}>
              {state.groups.map((g) => (
                <GroupRow
                  key={g.id}
                  group={g}
                  open={openId === g.id}
                  onToggle={() => setOpenId(openId === g.id ? null : g.id)}
                  refresh={refresh}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function GroupRow({
  group,
  open,
  onToggle,
  refresh,
}: {
  group: AdminGroup;
  open: boolean;
  onToggle(): void;
  refresh(): Promise<void>;
}) {
  const { api, toast } = useSurface();
  const { busy, error, run } = useAction();
  const removal = useTwoTap();
  const [values, setValues] = useState('');
  const [refused, setRefused] = useState<string[]>([]);

  const addMembers = async () => {
    if (!values.trim()) return;
    let added = 0;
    const ok = await run(async () => {
      const result = await saving(api.admin.addMembers(group.id, values));
      added = result.added;
      setRefused(result.refused);
    });
    if (!ok) return;
    toast(added ? `Додано учасників: ${added} ✓` : 'Нікого не додано — перевірте формат');
    if (added) setValues('');
    await refresh();
  };

  const removeMember = async (memberId: number) => {
    if (await run(() => saving(api.admin.removeMember(group.id, memberId)))) await refresh();
  };

  const removeGroup = async () => {
    try {
      await api.admin.deleteGroup(group.id);
      toast('Групу видалено');
      await refresh();
    } catch (err) {
      toast(failText(err)); // 409: the group stays, the server names how many products hold it
    }
  };

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          'flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-white/5',
          CONTROL,
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold leading-snug">
            👥 {group.name}
          </span>
          <span className="block text-[13px] font-semibold text-muted">
            Учасників: {group.members.length}
          </span>
        </span>
        <Icon
          d={ICONS.chevron}
          className={cn('size-4 shrink-0 text-subtle transition-transform', open && 'rotate-90')}
        />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {group.members.length > 0 && (
            <ul className="divide-y divide-border/60 rounded-2xl border border-border bg-bg/60">
              {group.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-1 pl-3.5 pr-1">
                  <span className="min-w-0 truncate text-sm font-bold">
                    {m.username ? `@${m.username}` : `ID: ${m.telegramId}`}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeMember(m.id)}
                    className="min-h-11 shrink-0 rounded-xl px-3 text-[13px] font-bold text-muted transition-colors hover:text-brand-red disabled:opacity-50"
                  >
                    Прибрати
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Textarea
            label="Додати учасників: Telegram ID або @username (через кому чи з нового рядка)"
            placeholder={'@username1, 123456789\n@username2'}
            rows={3}
            maxLength={5000}
            value={values}
            onChange={(e) => setValues(e.target.value)}
            onFocus={scrollOnFocus}
            autoCapitalize="none"
            autoCorrect="off"
            className="min-h-0"
          />
          {refused.length > 0 && <Banner tone="hint">Не додано: {refused.join(', ')}</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
          <Button
            disabled={busy || !values.trim()}
            onClick={() => void addMembers()}
            className="w-full rounded-2xl py-3.5 font-extrabold"
          >
            {busy ? 'Додаємо...' : 'Додати учасників'}
          </Button>
          <button
            type="button"
            onClick={() => removal.tap('group', () => void removeGroup())}
            className={cn(DANGER_CLASS, 'min-h-11 w-full')}
          >
            {removal.armed ? 'Натисніть ще раз для підтвердження' : 'Видалити групу'}
          </button>
        </div>
      )}
    </li>
  );
}
