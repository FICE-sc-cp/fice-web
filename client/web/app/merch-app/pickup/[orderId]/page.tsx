import { PickupScreen } from '@/components/merch/PickupScreen';

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <PickupScreen orderId={orderId} />;
}
