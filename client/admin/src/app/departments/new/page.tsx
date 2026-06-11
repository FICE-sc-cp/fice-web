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
      if (v.headFirstName && v.headLastName && v.headTelegramTag) {
        const head = await api.createDepartmentHead({
          firstName: v.headFirstName,
          lastName: v.headLastName,
          telegramTag: v.headTelegramTag,
          jobDescription: v.headJob || undefined,
          photo: v.headPhoto || undefined,
        });
        headId = head.id;
      }
      let detailsId: string | undefined;
      if (v.about?.trim()) {
        const det = await api.createDepartmentDetails({
          about: v.about,
          detailedDescription: v.detailedDescription || undefined,
          exampleOfWork: v.exampleOfWork || undefined,
        });
        detailsId = det.id;
      }
      return api.createDepartment({
        name: v.name,
        shortDescription: v.shortDescription,
        headId,
        detailsId,
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
      <PageHeader title="Новий відділ" />
      {mutation.error && (
        <p className="mb-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          {mutation.error instanceof Error ? mutation.error.message : 'Помилка'}
        </p>
      )}
      <DepartmentForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={(v) => mutation.mutate(v)}
      />
    </main>
  );
}
