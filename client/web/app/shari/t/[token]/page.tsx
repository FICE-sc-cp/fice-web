import type { Metadata } from 'next';
import { GradientText } from '@/components/ui/GradientText';
import { SHARI_METADATA, ShariShell } from '../../shell';
import { TeacherApp } from './TeacherApp';

export const metadata: Metadata = {
  title: { absolute: 'Шари для студентів — Студрада ФІОТ' },
  ...SHARI_METADATA,
};

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <ShariShell
      heading={
        <>
          Подаруйте студентам <GradientText>шари</GradientText>
        </>
      }
      lead={
        <p>
          Традиція ФІОТ: на день народження факультету викладачі дарують
          студентам бонуси — бали до рейтингу, підвищення оцінки чи закриття
          роботи.
        </p>
      }
    >
      <TeacherApp token={token} />
    </ShariShell>
  );
}
