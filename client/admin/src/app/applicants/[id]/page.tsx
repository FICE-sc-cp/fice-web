'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { hapticNotify } from '@/lib/telegram';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-subtle">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value}</span>
    </div>
  );
}

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const { data: a, isLoading } = useQuery({
    queryKey: ['applicant', id],
    queryFn: () => api.applicant(id),
  });

  const del = useMutation({
    mutationFn: () => api.deleteApplicant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applicants'] });
      hapticNotify('success');
      router.push('/applicants');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Заявка" />

      {isLoading || !a ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <p className="mb-2 break-words text-lg font-bold">
              {a.lastName} {a.firstName} {a.middleName}
            </p>
            <div className="flex justify-between gap-3 py-1.5 text-sm">
              <span className="shrink-0 text-subtle">Telegram</span>
              <a
                href={`https://t.me/${a.telegramTag.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 break-all text-right font-medium text-brand-cyan underline-offset-2 hover:underline"
              >
                {a.telegramTag}
              </a>
            </div>
            <Field label="Телефон" value={a.phoneNumber} />
            <Field label="Група" value={a.group} />
            <Field
              label="Подано"
              value={new Date(a.createdAt).toLocaleString('uk-UA')}
            />
          </Card>

          {a.applicantDepartments?.length ? (
            <Card>
              <p className="mb-2 text-sm font-semibold text-muted">Департаменти</p>
              <ul className="flex flex-col gap-2">
                {a.applicantDepartments.map((d) => (
                  <li key={d.id} className="rounded-lg bg-bg-soft px-3 py-2">
                    <p className="text-sm font-medium">{d.department.name}</p>
                    {d.question && (
                      <p className="mt-0.5 text-xs text-muted">{d.question}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {a.motivation && (
            <Card>
              <p className="mb-1 text-sm font-semibold text-muted">Мотивація</p>
              <p className="whitespace-pre-wrap text-sm">{a.motivation}</p>
            </Card>
          )}

          {a.experience && (
            <Card>
              <p className="mb-1 text-sm font-semibold text-muted">Досвід</p>
              <p className="whitespace-pre-wrap text-sm">{a.experience}</p>
            </Card>
          )}

          <Button variant="danger" onClick={() => setConfirm(true)}>
            Видалити заявку
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Видалити заявку?"
        message={a ? `${a.lastName} ${a.firstName}` : undefined}
        loading={del.isPending}
        error={del.error}
        onCancel={() => {
          setConfirm(false);
          del.reset();
        }}
        onConfirm={() => del.mutate()}
      />
    </main>
  );
}
