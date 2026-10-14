import type { Metadata } from 'next';
import { GradientText } from '@/components/ui/GradientText';
import { ApiError, request } from '@/lib/api';
import type { CheckResult } from '@/lib/shari';
import { SHARI_METADATA, ShariShell } from '../../shell';
import { Banner, Panel } from '../../ui';

export const metadata: Metadata = {
  title: { absolute: 'Перевірка шари — Студрада ФІОТ' },
  ...SHARI_METADATA,
};

/** Where a certificate's QR code leads: the shara as the database has it. */
export default async function CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let result: CheckResult | 'missing' | 'error';
  try {
    result = await request<CheckResult>(`/shari/check/${encodeURIComponent(id)}`);
  } catch (err) {
    result = err instanceof ApiError && err.status < 500 ? 'missing' : 'error';
  }

  return (
    <ShariShell
      heading={
        <>
          Перевірка <GradientText>шари</GradientText>
        </>
      }
    >
      {result === 'missing' ? (
        <Banner tone="warn">
          ❌ Такої шари немає. Сертифікат недійсний: його підробили або шару вже
          передали іншому студенту.
        </Banner>
      ) : result === 'error' ? (
        <Banner tone="warn">Не вдалося перевірити шару. Спробуйте за хвилину.</Banner>
      ) : (
        <>
          <Banner tone="ok">
            ✅ Шара справжня. Звірте дані нижче з сертифікатом і студентом.
          </Banner>
          <Panel>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[10rem_1fr]">
              {(
                [
                  ['Студент', result.studentName],
                  ['Група', result.group],
                  ['Предмет', result.discipline],
                  ['Бонус', result.bonus],
                  ['Умова', result.condition],
                  ['Викладач', result.teacher],
                ] as const
              )
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-subtle">{label}</dt>
                    <dd className="text-lg font-semibold">{value}</dd>
                  </div>
                ))}
            </dl>
          </Panel>
        </>
      )}
    </ShariShell>
  );
}
