import type { Metadata } from 'next';
import { SHARI_METADATA, ShariShell } from './shell';
import { StaffApp } from './StaffApp';

export const metadata: Metadata = {
  title: { absolute: 'Шари — для старост і президії' },
  ...SHARI_METADATA,
};

export default function ShariPage() {
  return (
    <ShariShell
      title="для старост"
      lead={
        <p>
          Тут видно шари, які викладачі дали твоїй групі. Розіграй їх і впиши,
          кому дісталась кожна, — сертифікат із QR-кодом зʼявиться одразу.
        </p>
      }
    >
      <StaffApp />
    </ShariShell>
  );
}
