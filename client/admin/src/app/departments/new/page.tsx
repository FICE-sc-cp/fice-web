'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  DepartmentForm,
  type DepartmentFormValues,
} from '@/components/forms/DepartmentForm';
import { hapticNotify } from '@/lib/telegram';

export default function NewDepartmentPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (v: DepartmentFormValues) => {
      let headId: string | undefined;
      if (v.headFirstName && v.headLastName) {
        const head = await api.createDepartmentHead({
          firstName: v.headFirstName,
          lastName: v.headLastName,
          telegramTag: v.headTelegramTag?.trim() ? v.headTelegramTag.trim() : undefined,
          photo: v.headPhoto || undefined,
        });
        headId = head.id;
      }
      return api.createDepartment({
        name: v.name,
        memberCount: v.memberCount?.trim() ? Number(v.memberCount) : undefined,
        telegramChatId: v.telegramChatId?.trim() || undefined,
        headId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      hapticNotify('success');
      router.push('/departments');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Новий департамент" />
      <DepartmentForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={(v) => mutation.mutate(v)}
        error={mutation.error}
      />
    </main>
  );
}
