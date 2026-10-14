import type { Metadata } from 'next';
import { GradientText } from '@/components/ui/GradientText';
import { SHARI_METADATA, ShariShell } from './shell';
import { StaffApp } from './StaffApp';

export const metadata: Metadata = {
  title: { absolute: 'Шари — для старост і президії' },
  ...SHARI_METADATA,
};

export default function ShariPage() {
  return (
    <ShariShell
      heading={
        <>
          Роздай <GradientText>шари</GradientText> своїй групі
        </>
      }
      lead={
        <p>
          Тут видно шари, які викладачі подарували твоїй групі. Розіграй їх і
          впиши, кому дісталась кожна, — сертифікат із QR-кодом зʼявиться одразу.
        </p>
      }
    >
      <StaffApp />
    </ShariShell>
  );
}
