import { redirect } from 'next/navigation';
import { Catalog } from '@/components/merch/Catalog';
import { safe } from '@/lib/api';
import { merchCatalog } from '@/lib/merch';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; order_id?: string }>;
}) {
  const q = await searchParams;
  // Buttons on old messages in customers' chats still open these.
  if (q.page === 'admin') redirect('/merch-app/admin');
  if (q.page === 'pickup' && /^[1-9]\d{0,8}$/.test(q.order_id ?? '')) {
    redirect(`/merch-app/pickup/${q.order_id}`);
  }
  return <Catalog initial={await safe(merchCatalog(), null)} />;
}
