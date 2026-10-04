'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  mediaUrl,
  type PeopleImportSummary,
  type ProjectParticipant,
} from '@/lib/api';
import { saveFile } from '@/lib/download';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUpload } from '@/components/ImageUpload';
import { Spinner } from '@/components/ui/Spinner';
import { FormError } from '@/components/ui/FormError';
import { hapticNotify } from '@/lib/telegram';

export default function ProjectParticipantsPage() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['project-participants'] });

  const { data: people, isLoading } = useQuery({
    queryKey: ['project-participants'],
    queryFn: () => api.projectParticipants(),
  });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.departments(),
  });

  const deptName = useMemo(() => {
    const m = new Map<string, string>();
    departments?.forEach((d) => m.set(d.id, d.name));
    return m;
  }, [departments]);

  const deptOptions = useMemo(
    () => [
      { value: '', label: 'Усі департаменти' },
      ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
    ],
    [departments],
  );

  const [filterDept, setFilterDept] = useState('');
  const [fullName, setFullName] = useState('');
  const [telegramTag, setTelegramTag] = useState('');
  const [addDept, setAddDept] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const shown = (people ?? []).filter(
    (p) => !filterDept || p.departmentId === filterDept,
  );

  const addMutation = useMutation({
    mutationFn: () =>
      api.createProjectParticipant({
        fullName: fullName.trim(),
        telegramTag: telegramTag.trim()
          ? `@${telegramTag.trim().replace(/^@/, '')}`
          : undefined,
        departmentId: addDept || undefined,
        photo: photo ?? undefined,
      }),
    onSuccess: () => {
      hapticNotify('success');
      setFullName('');
      setTelegramTag('');
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

  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [downloadingConfig, setDownloadingConfig] = useState(false);
  const [importResult, setImportResult] = useState<PeopleImportSummary | null>(
    null,
  );

  const downloadConfig = async () => {
    setDownloadingConfig(true);
    setConfigError(null);
    try {
      await saveFile({
        fileName: 'people-wall-config.json',
        createLink: () => api.peopleWallConfigLink(),
        loadBlob: () => api.peopleWallConfig(),
      });
    } catch (e) {
      setConfigError(
        e instanceof Error ? e.message : 'Не вдалося завантажити конфіг',
      );
    } finally {
      setDownloadingConfig(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: (file: File) => api.importPeopleWall(file),
    onMutate: () => setImportResult(null),
    onSuccess: (res) => {
      hapticNotify('success');
      setImportResult(res);
      invalidate();
    },
    onError: () => hapticNotify('error'),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.syncProjectParticipants(filterDept || undefined),
    onSuccess: (res) => {
      hapticNotify('success');
      setSyncStatus(
        `Синхронізовано! Перевірено учасників: ${res.checked}, видалено (хто пішов): ${res.removed}, приховано: ${res.hidden}${res.errors > 0 ? `, помилок: ${res.errors}` : ''}.`,
      );
      invalidate();
    },
    onError: (err) => {
      hapticNotify('error');
      setSyncStatus(
        `Помилка синхронізації: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Люди департаментів" />

      <p className="mb-4 text-sm text-muted">
        Учасники з тегом «авто» додаються ботом із чатів департаментів (chat ID
        налаштовується у формі департаменту). Можна додати людину вручну або
        приховати будь-кого з публічної стінки.
      </p>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-bg-soft p-4">
        <p className="text-sm font-semibold text-muted">Імпорт з Telegram</p>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-xs text-subtle">
          <li>Завантаж конфіг: у ньому департаменти та їхні Telegram-чати.</li>
          <li>
            На своєму компʼютері запусти інструмент{' '}
            <code>tools/people-wall-export</code> із цим конфігом (інструкція в
            його README). Він створить один архів.
          </li>
          <li>Завантаж архів сюди.</li>
        </ol>
        <Button
          type="button"
          variant="outline"
          disabled={downloadingConfig}
          onClick={() => void downloadConfig()}
        >
          {downloadingConfig ? 'Завантаження…' : 'Конфіг для експорту'}
        </Button>
        {configError && <p className="text-xs text-brand-red">{configError}</p>}
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-bg py-5 text-sm text-subtle transition-colors hover:border-brand-cyan ${
            importMutation.isPending ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          {importMutation.isPending ? (
            <Spinner />
          ) : (
            <span>Імпортувати архів (.zip)</span>
          )}
          <input
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            disabled={importMutation.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) importMutation.mutate(file);
            }}
          />
        </label>
        <FormError error={importMutation.error} />
        {importResult && (
          <div className="flex flex-col gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-fg">
            <p>
              Додано: <b>{importResult.added}</b>, оновлено:{' '}
              <b>{importResult.updated}</b>, пропущено:{' '}
              <b>{importResult.skipped}</b>.
            </p>
            <p className="text-xs text-subtle">
              Інструмент уже відкинув ботів ({importResult.skippedByTool.bots})
              і видалені акаунти ({importResult.skippedByTool.deleted}).
              {importResult.unknownDepartments > 0 &&
                ` Департаментів, яких уже немає: ${importResult.unknownDepartments}.`}
            </p>
            {importResult.possibleDuplicates.length > 0 && (
              <div className="text-xs">
                <p className="font-semibold">
                  Не додано, бо вже є ручний запис із таким імʼям:
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {importResult.possibleDuplicates.map((d, i) => (
                    <li key={i}>
                      {d.fullName} — {d.department}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-bg-soft p-4">
        <p className="text-sm font-semibold text-muted">Додати вручну</p>
        <Input
          label="ПІБ"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Telegram (необовʼязково)"
            placeholder="@username"
            value={telegramTag}
            onChange={(e) => setTelegramTag(e.target.value)}
          />
          <p className="text-xs text-subtle">
            Якщо вказати @username, бот не додасть цю людину вдруге, коли вона
            напише в чаті департаменту.
          </p>
        </div>
        <Select
          label="Департамент"
          options={[{ value: '', label: 'Без департаменту' }, ...deptOptions.slice(1)]}
          value={addDept}
          onChange={(e) => setAddDept(e.target.value)}
        />
        <ImageUpload label="Аватарка" value={photo} onChange={setPhoto} />
        <FormError error={addMutation.error} />
        <Button
          type="button"
          disabled={!fullName.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {addMutation.isPending ? 'Додавання…' : 'Додати'}
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select
            label="Показати"
            options={deptOptions}
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value);
              setSyncStatus(null);
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={syncMutation.isPending}
          onClick={() => syncMutation.mutate()}
          className="whitespace-nowrap"
        >
          {syncMutation.isPending ? 'Синхронізація…' : '🔄 Синхронізувати з Telegram'}
        </Button>
      </div>

      {syncStatus ? (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${
            syncMutation.isError
              ? 'border-brand-red/30 bg-brand-red/10 text-brand-red'
              : 'border-brand-green/30 bg-brand-green/10 text-brand-green'
          }`}
        >
          {syncStatus}
        </div>
      ) : null}

      {toggleHidden.error || removeMutation.error ? (
        <div className="mb-3">
          <FormError error={toggleHidden.error ?? removeMutation.error} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !shown.length ? (
        <p className="py-8 text-center text-sm text-subtle">
          Ще нікого немає. Вкажи Telegram chat ID у формі департаменту й додай
          бота в той чат (адміном, з вимкненим privacy mode).
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((p) => {
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
                    {(p.departmentId && deptName.get(p.departmentId)) ||
                      'без департаменту'}
                    {' · '}
                    {p.telegramTag ?? '—'} ·{' '}
                    {p.source === 'MANUAL' ? 'вручну' : 'авто'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleHidden.mutate(p)}
                    disabled={toggleHidden.isPending}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg disabled:pointer-events-none disabled:opacity-50"
                  >
                    {p.hidden ? 'Показати' : 'Сховати'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(p.id)}
                    disabled={removeMutation.isPending}
                    className="rounded-lg border border-brand-red/40 px-3 py-1.5 text-sm text-brand-red transition-colors hover:bg-brand-red/10 disabled:pointer-events-none disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
