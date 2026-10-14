import type { Metadata } from 'next';
import { GradientText } from '@/components/ui/GradientText';
import { ApiError, request } from '@/lib/api';
import type { CheckResult } from '@/lib/shari';
import { Sphere, Ticket, sharaColor } from '../../decor';
import { SHARI_METADATA, ShariShell } from '../../shell';
import { Panel } from '../../ui';

export const metadata: Metadata = {
  title: { absolute: 'Перевірка шари — Студрада ФІОТ' },
  ...SHARI_METADATA,
};

function Verdict({
  ok,
  title,
  text,
}: {
  ok: boolean;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-5">
      <Sphere color={ok ? 'green' : 'magenta'} size={84} className="text-4xl">
        {ok ? '✓' : '✕'}
      </Sphere>
      <div>
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-1 text-muted">{text}</p>
      </div>
    </div>
  );
}

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
        <Panel>
          <Verdict
            ok={false}
            title="Такої шари немає"
            text="Сертифікат недійсний: його підробили або шару вже передали іншому студенту."
          />
        </Panel>
      ) : result === 'error' ? (
        <Panel>
          <p className="text-muted">Не вдалося перевірити шару. Спробуйте за хвилину.</p>
        </Panel>
      ) : (
        <>
          <Verdict ok title="Шара справжня" text="Звірте дані нижче з сертифікатом і студентом." />
          <Ticket
            color={sharaColor(result.bonus)}
            stub={
              <>
                <span className="text-3xl font-black">✓</span>
                <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.18em]">справжня</span>
              </>
            }
          >
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[7rem_1fr]">
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
                    <dt className="text-xs font-extrabold uppercase tracking-[0.16em] text-subtle sm:pt-1">{label}</dt>
                    <dd className="text-lg font-bold">{value}</dd>
                  </div>
                ))}
            </dl>
          </Ticket>
        </>
      )}
    </ShariShell>
  );
}
