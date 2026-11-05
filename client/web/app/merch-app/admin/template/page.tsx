'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductForm } from '@/components/merch/admin/ProductForm';
import { Spinner } from '@/components/merch/ui';

/** A client page, for the same reason as admin/product. */
function Form() {
  const value = useSearchParams().get('id');
  return (
    <ProductForm
      key={value}
      mode="template"
      id={value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined}
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
