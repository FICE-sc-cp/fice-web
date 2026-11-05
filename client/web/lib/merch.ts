import { ApiError, request } from '@/lib/api';
import type {
  AdminState,
  CartLine,
  CartPreview,
  Catalog,
  CheckoutStart,
  CreateOrderBody,
  CreatedOrder,
  LabelKind,
  LinkPoll,
  LinkStart,
  MerchDeliveryMethod,
  MerchOrderStatus,
  OrderRow,
  PickupInfo,
  ProductBody,
  ProductView,
  Recipient,
  TemplateBody,
} from '@/lib/merch-types';

const DEV_KEY = 'merch-dev';

/** ?tgUserId=&tgTag= under AUTH_DISABLED, kept in sessionStorage for the session; '' otherwise. */
export function devQuery(): string {
  if (typeof window === 'undefined') return '';
  const url = new URLSearchParams(location.search);
  const id = url.get('tgUserId');
  const fresh = id
    ? `?tgUserId=${encodeURIComponent(id)}&tgTag=${encodeURIComponent(url.get('tgTag') ?? '')}`
    : '';
  try {
    if (fresh) sessionStorage.setItem(DEV_KEY, fresh);
    return fresh || (sessionStorage.getItem(DEV_KEY) ?? '');
  } catch {
    return fresh;
  }
}

/** The cart stores labels too, and an extra field is a 400 from forbidNonWhitelisted. */
const bare = (lines: CartLine[]): CartLine[] =>
  lines.map(({ variantId, quantity }) => ({ variantId, quantity }));

/** onUnauthorized runs on any 401, so a dead session is handled in one place. */
export function merchApi(headers: Record<string, string>, onUnauthorized?: () => void) {
  const send = <T>(path: string, init: RequestInit) =>
    request<T>(`/merch${path}${devQuery()}`, init).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized?.();
      throw err;
    });

  const call = <T>(method: string, path: string, body?: unknown) =>
    send<T>(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  /** No Content-Type: the browser adds it with the multipart boundary. */
  const uploadPhoto = (file: Blob) => {
    const form = new FormData();
    form.append('file', file, 'photo.jpg');
    return send<{ url: string }>('/admin/upload', { method: 'POST', headers, body: form });
  };

  return {
    catalog: () => call<Catalog>('GET', '/catalog'),
    product: (id: string | number) => call<ProductView>('GET', `/products/${id}`),
    preview: (lines: CartLine[]) => call<CartPreview>('POST', '/cart/preview', { lines: bare(lines) }),
    startLink: () => call<LinkStart>('POST', '/link'),
    pollLink: (token: string) => call<LinkPoll>('GET', `/link/${token}`),
    endLink: () => call<{ ok: true }>('DELETE', '/link'),
    startCheckout: (lines: CartLine[]) =>
      call<CheckoutStart>('POST', '/checkout/start', { lines: bare(lines) }),
    createOrder: (body: CreateOrderBody) => call<CreatedOrder>('POST', '/orders', body),
    orders: () => call<{ orders: OrderRow[] }>('GET', '/orders'),
    recipients: () => call<{ recipients: Recipient[] }>('GET', '/recipients'),
    addRecipient: (body: { fullName: string; phone: string }) =>
      call<{ id: number }>('POST', '/recipients', body),
    deleteRecipient: (id: number) => call<{ ok: true }>('DELETE', `/recipients/${id}`),
    defaultRecipient: (id: number) => call<{ ok: true }>('POST', `/recipients/${id}/default`),
    pickupInfo: (orderId: string) => call<PickupInfo>('GET', `/orders/${orderId}/pickup`),
    choosePickup: (
      orderId: string,
      body: { pickupSlotId: number | null; needsIndividualPickup: boolean },
    ) => call<{ ok: true }>('POST', `/orders/${orderId}/pickup`, body),
    admin: {
      check: () => call<{ isAdmin: true }>('GET', '/admin/check'),
      state: () => call<AdminState>('GET', '/admin/state'),
      createProduct: (body: ProductBody) => call<{ id: number }>('POST', '/admin/products', body),
      updateProduct: (id: number, body: ProductBody) =>
        call<{ ok: true }>('PUT', `/admin/products/${id}`, body),
      setActive: (id: number, isActive: boolean) =>
        call<{ ok: true; isActive: boolean }>('PATCH', `/admin/products/${id}/active`, { isActive }),
      deleteProduct: (id: number) => call<{ ok: true }>('DELETE', `/admin/products/${id}`),
      reorderProducts: (ids: number[]) =>
        call<{ ok: true }>('POST', '/admin/products/reorder', { ids }),
      createLabel: (kind: LabelKind, name: string) =>
        call<{ id: number }>('POST', `/admin/labels/${kind}`, { name }),
      renameLabel: (kind: LabelKind, id: number, name: string) =>
        call<{ ok: true }>('PATCH', `/admin/labels/${kind}/${id}`, { name }),
      deleteLabel: (kind: LabelKind, id: number) =>
        call<{ ok: true }>('DELETE', `/admin/labels/${kind}/${id}`),
      reorderLabels: (kind: LabelKind, ids: number[]) =>
        call<{ ok: true }>('POST', `/admin/labels/${kind}/reorder`, { ids }),
      createTemplate: (body: TemplateBody) => call<{ id: number }>('POST', '/admin/templates', body),
      updateTemplate: (id: number, body: TemplateBody) =>
        call<{ ok: true }>('PUT', `/admin/templates/${id}`, body),
      deleteTemplate: (id: number) => call<{ ok: true }>('DELETE', `/admin/templates/${id}`),
      createGroup: (name: string) => call<{ id: number }>('POST', '/admin/groups', { name }),
      deleteGroup: (id: number) => call<{ ok: true }>('DELETE', `/admin/groups/${id}`),
      addMembers: (id: number, values: string) =>
        call<{ added: number; refused: string[] }>('POST', `/admin/groups/${id}/members`, { values }),
      removeMember: (id: number, memberId: number) =>
        call<{ ok: true }>('DELETE', `/admin/groups/${id}/members/${memberId}`),
      createSlot: (body: { date: string; startTime: string; endTime: string }) =>
        call<{ id: number }>('POST', '/admin/slots', body),
      deleteSlot: (id: number) =>
        call<{ ok: true; deactivated: boolean }>('DELETE', `/admin/slots/${id}`),
      upload: uploadPhoto,
    },
  };
}

export type MerchApi = ReturnType<typeof merchApi>;

// Public reads go through plain request(), so generateMetadata and the page share one fetch.
export const merchCatalog = () => request<Catalog>('/merch/catalog');
export const merchProduct = (id: string | number) => request<ProductView>(`/merch/products/${id}`);

/** Whole hryvnias bare, otherwise two decimals: 500, 500.50. Not formatUAH, which rounds. */
export const priceText = (price: string): string => {
  const value = Number(price);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

export const isValidUaPhone = (v: string) => /^(\+?380|0)\d{9}$/.test(v.replace(/[\s\-().]/g, ''));

export const STATUS_LABEL: Record<MerchOrderStatus, string> = {
  PENDING: 'Очікує',
  IN_PROCESS: 'В роботі',
  READY_FOR_PICKUP: 'Готове до видачі',
  COMPLETED: 'Виконано',
  CANCELLED: 'Скасовано',
};

export const DELIVERY_LABEL: Record<MerchDeliveryMethod, string> = {
  NOVA_POSHTA: 'Нова Пошта',
  CAMPUS: 'На DayF',
  DAYF: 'DayF',
  LATER_CAMPUS: 'В корпусі',
};

let lastCatalog: Catalog | null = null;

/**
 * Module variable: last catalog, so a product opens at once from the list and back is instant.
 * Effects only: on the server this variable is shared by every request.
 */
export function rememberCatalog(c?: Catalog): Catalog | null {
  if (c) lastCatalog = c;
  return lastCatalog;
}

/** The list URL with its query. Catalog sets it in effects only, so the server copy stays null. */
let lastCatalogUrl: string | null = null;
export const rememberCatalogUrl = (url: string) => {
  lastCatalogUrl = url;
};

export function parentOf(path: string, base: '/merch' | '/merch-app'): string | null {
  const p = path.slice(base.length) || '/';
  if (p === '/' || p === '/orders' || p === '/profile' || p === '/admin') return null;
  if (p === '/checkout') return lastCatalogUrl ?? base; // the cart is a sheet over the page, not a page
  if (p.startsWith('/pickup/')) return `${base}/orders`;
  if (p === '/admin/template') return `${base}/admin/templates`;
  if (p.startsWith('/admin/')) return `${base}/admin`;
  return lastCatalogUrl ?? base; // product: back to the list with its filters
}
