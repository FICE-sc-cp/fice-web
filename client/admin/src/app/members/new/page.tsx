'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { MemberForm, type MemberFormValues } from '@/components/forms/MemberForm';
import { hapticNotify } from '@/lib/telegram';

export default function NewMemberPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (v: MemberFormValues) =>
      api.createMember({
        role: v.role,
        firstName: v.firstName,
        lastName: v.lastName,
        specialization: v.specialization?.trim() ? v.specialization : undefined,
        photo: v.photo ?? undefined,
        telegramTag: v.telegramTag?.trim() ? v.telegramTag.trim() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      hapticNotify('success');
      router.push('/members');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Додати до президії" />
      <MemberForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={(v) => mutation.mutate(v)}
        error={mutation.error}
      />
    </main>
  );
}
