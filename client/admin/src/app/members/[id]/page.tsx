'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { MemberForm, type MemberFormValues } from '@/components/forms/MemberForm';
import { MemberDepartments } from '@/components/MemberDepartments';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

export default function EditMemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: member, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.members(),
    select: (list) => list.find((m) => m.id === id) ?? null,
  });

  const mutation = useMutation({
    mutationFn: (v: MemberFormValues) =>
      api.updateMember(id, {
        role: v.role,
        firstName: v.firstName,
        lastName: v.lastName,
        specialization: v.specialization?.trim() ? v.specialization : null,
        photo: v.photo || null,
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
      <PageHeader title="Редагувати учасника" />
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <MemberForm
            submitLabel="Зберегти"
            submitting={mutation.isPending}
            onSubmit={(v) => mutation.mutate(v)}
            error={mutation.error}
            defaultValues={
              member
                ? {
                    role: member.role,
                    firstName: member.firstName,
                    lastName: member.lastName,
                    specialization: member.specialization ?? '',
                    photo: member.photo,
                    telegramTag: member.telegramTag ?? '',
                  }
                : undefined
            }
          />
          {member && (
            <MemberDepartments
              memberId={member.id}
              assignments={member.assignments ?? []}
            />
          )}
        </>
      )}
    </main>
  );
}
