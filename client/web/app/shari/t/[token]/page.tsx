import type { Metadata } from 'next';
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
      title="для студентів"
      lead={
        <p>
          На день народження ФІОТ викладачі дарують студентам «шари» — бонуси
          до рейтингу, підвищення оцінки чи закриття роботи. Тут ви вказуєте,
          які шари даєте і яким групам.
        </p>
      }
    >
      <TeacherApp token={token} />
    </ShariShell>
  );
}
