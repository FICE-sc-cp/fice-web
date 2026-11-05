'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductForm } from '@/components/merch/admin/ProductForm';
import { Spinner } from '@/components/merch/ui';

const idOf = (value: string | null) =>
  value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined;

/** A client page: from the list the form opens at once, without a server round trip. */
function Form() {
  const query = useSearchParams();
  return (
    <ProductForm
      key={query.toString()}
      mode="product"
      id={idOf(query.get('id'))}
      copy={idOf(query.get('copy'))}
      template={idOf(query.get('template'))}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <Form />
    </Suspense>
  );
}
