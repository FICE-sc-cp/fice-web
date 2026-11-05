export type MerchOrderStatus = 'PENDING' | 'IN_PROCESS' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED';
export type MerchDeliveryMethod = 'NOVA_POSHTA' | 'CAMPUS' | 'DAYF' | 'LATER_CAMPUS';

export interface Label { id: number; name: string }

export interface CatalogItem {
  id: number;
  title: string;
  categoryId: number | null;
  tagIds: number[];
  thumbUrl: string | null;     // photo of the default colour
  minPrice: string;            // lowest price among available variants, else among all
  soldOut: boolean;            // no variant is available
}

export interface Catalog {
  products: CatalogItem[];     // in display order
  categories: Label[];         // only those the viewer's products use, in order
  tags: Label[];               // same
  botUsername: string | null;  // null while the bot is off; hides "Відкрити в боті"
}

export interface ProductVariant { id: number; size: string; color: string; price: string; stock: number | null }
export interface ProductPhoto { color: string; url: string; thumbUrl: string }

export interface ProductView {
  id: number;
  title: string;
  description: string;
  archived: boolean;           // true: variants is [], no buy controls, the page is noindex
  categoryId: number | null;
  tagIds: number[];
  colors: string[];            // colour step, in matrix order; [] means no colour step
  sizes: string[];             // size step, in matrix order; [] means no size step
  fixedSize: string | null;    // a real single size shown as text when there is no size step
  defaultColor: string;        // first colour with stock, else the first colour, else ''
  minPrice: string | null;
  variants: ProductVariant[];
  photos: ProductPhoto[];
  botUsername: string | null;  // null while the bot is off; hides "Відкрити в боті"
}

export interface CartLine { variantId: number; quantity: number }   // request shape

export type LineStatus = 'ok' | 'short' | 'soldout' | 'archived' | 'gone';

export interface CartLineView {
  variantId: number;
  productId: number | null;
  title: string | null;        // null for a gone or hidden line
  size: string | null;         // null when NO_SIZE or the line is gone
  color: string;
  options: string;             // "M — Білий", '' when nothing to show
  thumbUrl: string | null;
  unitPrice: string | null;
  lineTotal: string;           // full quantity, as the order charges it; "0.00" for gone lines
  quantity: number;            // as requested
  maxQuantity: number;
  status: LineStatus;
}

export interface CartPreview { lines: CartLineView[]; total: string; hasProblems: boolean }

export interface Recipient { id: number; fullName: string; phone: string; isDefault: boolean }

export interface ShopInfo {
  monoJarUrl: string;
  cardNumber: string | null;
  dayfEnabled: boolean;
  currency: string;
}

export interface CheckoutStart { cart: CartPreview; recipients: Recipient[]; shop: ShopInfo }

export interface OrderRow {
  id: number;
  status: MerchOrderStatus;
  totalAmount: string;
  createdAt: string;           // ISO
  deliveryMethod: MerchDeliveryMethod | null;
  address: string;
  items: { title: string; options: string; quantity: number; unitPrice: string }[];
  pickupLabel: string | null;  // "12.11, 12:00–14:00" with an en dash
  needsIndividualPickup: boolean;
  canChoosePickup: boolean;    // server rule, so no client guard to get wrong
}

export interface PickupSlotView { id: number; date: string; startTime: string; endTime: string; label: string }
export interface PickupInfo { id: number; status: MerchOrderStatus; canChoose: boolean; slots: PickupSlotView[] }

export interface LinkStart { token: string; botUrl: string; expiresAt: string }
export type LinkPoll = { linked: false } | { linked: true; session: string };

export interface CreatedOrder { id: number; total: string; repeated: boolean }

export interface CreateOrderBody {
  clientKey: string;
  lines: { variantId: number; quantity: number; label: string }[];
  expectedTotal: string;
  delivery: 'NOVA_POSHTA' | 'DAYF' | 'LATER_CAMPUS';
  address?: string;
  recipientId?: number;
  recipientName?: string;
  recipientPhone?: string;
  saveRecipient?: boolean;
  receiptUrl: string;
}

// ---- Admin ----------------------------------------------------------------
export interface AdminVariant extends ProductVariant { order: number }
export interface AdminProduct {
  id: number; title: string; description: string; isActive: boolean; order: number;
  saveKey: string | null;      // goes back as seenKey
  categoryId: number | null; tagIds: number[]; groupIds: number[];
  variants: AdminVariant[]; photos: ProductPhoto[];
}
export interface AdminLabel extends Label { order: number; products: number }
export interface AdminGroupMember { id: number; telegramId: string | null; username: string | null }
export interface AdminGroup { id: number; name: string; products: number; members: AdminGroupMember[] }
export interface TemplatePrice { size: string; color: string; price: string }
export interface AdminTemplate {
  id: number; name: string; categoryId: number | null; description: string;
  tagIds: number[]; groupIds: number[]; sizes: string[]; colors: string[]; prices: TemplatePrice[];
}
export interface AdminSlot { id: number; date: string; startTime: string; endTime: string; isActive: boolean; orders: number }
export type LabelKind = 'category' | 'tag';
export interface ProductBody {
  saveKey: string; seenKey: string | null;
  title: string; description: string; categoryId: number | null; tagIds: number[]; groupIds: number[];
  variants: { size: string; color: string; price: string; order: number; stock: number | null; stockSeen?: number | null }[];
  photos: ProductPhoto[];
}
export interface TemplateBody {
  name: string; description: string; categoryId: number | null; tagIds: number[]; groupIds: number[];
  sizes: string[]; colors: string[]; prices: TemplatePrice[];
}
export interface AdminState {
  adminChatBound: boolean;
  products: AdminProduct[];    // all, archived too, order ASC, id DESC
  categories: AdminLabel[];
  tags: AdminLabel[];
  groups: AdminGroup[];
  templates: AdminTemplate[];
  slots: AdminSlot[];          // newest date first
}
