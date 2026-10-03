'use client';

import Link from 'next/link';
import { Container } from '@/components/ui/Container';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="overflow-x-clip">
      <Container>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-3xl font-bold">Щось пішло не так</h1>
          <p className="text-muted">
            Сервер тимчасово не відповідає. Спробуйте оновити сторінку за хвилину.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-gradient-main px-6 py-3 font-bold text-black"
            >
              Спробувати ще раз
            </button>
            <Link
              href="/"
              className="rounded-xl border border-border px-6 py-3 font-bold text-fg"
            >
              На головну
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
