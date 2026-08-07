'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  DepartmentForm,
  type DepartmentFormValues,
} from '@/components/forms/DepartmentForm';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

export default function EditDepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: dep, isLoading } = useQuery({
    queryKey: ['department', id],
    queryFn: () => api.department(id),
  });

  const mutation = useMutation({
    mutationFn: async (v: DepartmentFormValues) => {
      let headId = dep?.headId ?? undefined;
      if (v.headFirstName && v.headLastName) {
        const body = {
          firstName: v.headFirstName,
          lastName: v.headLastName,
          telegramTag: v.headTelegramTag?.trim() ? v.headTelegramTag.trim() : undefined,
          photo: v.headPhoto || null,
        };
        if (dep?.headId) {
          await api.updateDepartmentHead(dep.headId, body);
        } else {
          const h = await api.createDepartmentHead(body);
          headId = h.id;
        }
      }

      return api.updateDepartment(id, {
        name: v.name,
        memberCount: v.memberCount?.trim() ? Number(v.memberCount) : undefined,
        telegramChatId: v.telegramChatId?.trim() || null,
        headId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      qc.invalidateQueries({ queryKey: ['department', id] });
      hapticNotify('success');
      router.push('/departments');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Редагувати департамент" />
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <DepartmentForm
          submitLabel="Зберегти"
          submitting={mutation.isPending}
          onSubmit={(v) => mutation.mutate(v)}
          error={mutation.error}
          defaultValues={
            dep
              ? {
                  name: dep.name,
                  memberCount:
                    dep.memberCount != null ? String(dep.memberCount) : '',
                  telegramChatId: dep.telegramChatId ?? '',
                  headFirstName: dep.head?.firstName ?? '',
                  headLastName: dep.head?.lastName ?? '',
                  headTelegramTag: dep.head?.telegramTag ?? '',
                  headPhoto: dep.head?.photo ?? null,
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
