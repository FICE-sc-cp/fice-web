'use client';

import { useState } from 'react';
import { FundraiserCard } from '@/components/charity/FundraiserCard';
import { ViewAllButton } from '@/components/ui/ViewAllLink';
import { fice, type Fundraiser } from '@/lib/api';

export function ClosedFundraisers({
  initial,
  total,
  pageSize,
}: {
  initial: Fundraiser[];
  total: number;
  pageSize: number;
}) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const next = await fice.fundraisers(pageSize, page + 1, 'CLOSED');
      setItems((prev) => [...prev, ...next.items]);
      setPage((p) => p + 1);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <FundraiserCard key={f.id} fundraiser={f} />
        ))}
      </div>

      {failed && (
        <p className="mt-6 text-center text-sm text-brand-red">
          Не вдалося завантажити. Спробуй ще раз.
        </p>
      )}

      {items.length < total && (
        <div className="mt-10 flex justify-center">
          <ViewAllButton
            onClick={loadMore}
            disabled={loading}
            gradient="bg-gradient-magenta"
            accent="text-brand-magenta"
          >
            {loading ? 'Завантаження…' : 'Переглянути ще'}
          </ViewAllButton>
        </div>
      )}
    </>
  );
}
