/* ============================================================
   Mock data — UI prototype cho Web Admin Bot Tele
   Toàn bộ dữ liệu demo tĩnh, không phụ thuộc server/database.
   ============================================================ */

import { formatVnd } from "./format";

export type OrderPaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "UNDERPAID"
  | "OVERPAID"
  | "PAYMENT_REVIEW"
  | "REFUNDED";

export type OrderFulfillmentStatus =
  | "PENDING_PAYMENT"
  | "QUEUED"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus =
  | "pending"
  | "matched"
  | "duplicate"
  | "underpaid"
  | "overpaid"
  | "failed"
  | "unknown_code";
export type PaymentType = "order" | "topup" | "manual";
export type FulfillmentType = "stock" | "manual_upgrade" | "dealer_api";
export type Tab = "stock" | "service" | "dealer";

/* ── Nhãn trạng thái ── */
export const ORDER_PAYMENT_STATUS_LABEL: Record<OrderPaymentStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PENDING: "Chờ xác nhận",
  PAID: "Đã thanh toán",
  UNDERPAID: "Thiếu tiền",
  OVERPAID: "Thừa tiền",
  PAYMENT_REVIEW: "Cần kiểm tra",
  REFUNDED: "Đã hoàn tiền",
};

export const ORDER_FULFILLMENT_STATUS_LABEL: Record<OrderFulfillmentStatus, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  QUEUED: "Chờ xử lý",
  PREPARING: "Đang xử lý",
  READY: "Sẵn sàng giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Chờ khớp",
  matched: "Đã khớp",
  duplicate: "Trùng lặp",
  underpaid: "Thiếu tiền",
  overpaid: "Thừa tiền",
  failed: "Thất bại",
  unknown_code: "Sai mã",
};

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  order: "Đơn hàng",
  topup: "Nạp ví",
  manual: "Thủ công",
};

export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  stock: "Kho tự động",
  manual_upgrade: "Nâng cấp thủ công",
  dealer_api: "API đối tác",
};

export const WARRANTY_STATUS_LABEL: Record<string, string> = {
  open: "Mới tạo",
  processing: "Đang xử lý",
  waiting_customer: "Chờ khách",
  resolved: "Đã giải quyết",
  rejected: "Từ chối",
  closed: "Đã đóng",
};

export const BROADCAST_STATUS_LABEL: Record<string, string> = {
  draft: "Bản nháp",
  queued: "Đang chờ",
  sending: "Đang gửi",
  completed: "Hoàn thành",
  failed: "Lỗi",
  cancelled: "Đã hủy",
};

export const BROADCAST_TARGET_LABEL: Record<string, string> = {
  all: "Tất cả khách",
  vi: "Khách dùng tiếng Việt",
  customers: "Khách đã mua hàng",
  wallet: "Khách có số dư ví",
  inactive30: "Không hoạt động 30 ngày",
};

export const RANK_LEGEND = [
  { tier: "diamond", label: "Kim cương ≥ 10tr", cls: "from-cyan-500 to-blue-600" },
  { tier: "platinum", label: "Bạch kim ≥ 5tr", cls: "from-slate-400 to-slate-600" },
  { tier: "gold", label: "Vàng ≥ 2tr", cls: "from-amber-400 to-amber-600" },
  { tier: "silver", label: "Bạc ≥ 500k", cls: "from-slate-300 to-slate-400" },
  { tier: "bronze", label: "Đồng ≥ 100k", cls: "from-orange-400 to-orange-600" },
  { tier: "new", label: "🆕 Khách mới", cls: "from-slate-200 to-slate-300" },
] as const;

/* ── Danh mục ── */
export interface Category {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
  emoji: string;
  active: boolean;
  sortOrder: number;
  productCount: number;
}

export const categories: Category[] = [
  { id: "cat_1", name: "Cà phê", nameEn: "Coffee", slug: "ca-phe", emoji: "☕", active: true, sortOrder: 1, productCount: 2 },
  { id: "cat_2", name: "Trà sữa & Trà trái cây", nameEn: "Tea & Milktea", slug: "tra-sua-tra-trai-cay", emoji: "🧋", active: true, sortOrder: 2, productCount: 2 },
  { id: "cat_3", name: "Sinh tố & Nước ép", nameEn: "Smoothies & Juices", slug: "sinh-to-nuoc-ep", emoji: "🍹", active: true, sortOrder: 3, productCount: 2 },
  { id: "cat_4", name: "Bánh ngọt & Ăn vặt", nameEn: "Pastries & Snacks", slug: "banh-ngot-an-vat", emoji: "🍰", active: true, sortOrder: 4, productCount: 2 },
];

export const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Khác";

/* ── Sản phẩm ── */
export interface StockCounts {
  available: number;
  reserved: number;
  sold: number;
  disabled: number;
  total: number;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  nameEn: string;
  priceVnd: number;
  defaultCostVnd: number;
  fulfillmentType: FulfillmentType;
  active: boolean;
  sortOrder: number;
  description: string;
  descriptionEn: string;
  warrantyNote: string;
  dealerDisplayPreferred?: boolean;
  stockCounts?: StockCounts;
  pendingUpgradeOrders?: number;
  // dealer
  dealerSourceName?: string;
  dealerSourcePriceVnd?: number;
  dealerMarkupPercent?: number;
  dealerProductKey?: string;
  dealerLastStock?: number;
  dealerLastSyncedAt?: string;
  dealerPriceNeedsReview?: boolean;
  dealerSuggestedPriceVnd?: number;
}

export const products: Product[] = [
  {
    id: "prod_1",
    categoryId: "cat_1",
    name: "Cà phê Sữa đá",
    nameEn: "Iced Coffee with Milk",
    priceVnd: 35000,
    defaultCostVnd: 12000,
    fulfillmentType: "stock",
    active: true,
    sortOrder: 1,
    description: "Cà phê Phin Robusta đậm đà kết hợp sữa đặc Ngôi Sao Phương Nam.",
    descriptionEn: "Rich Vietnamese drip coffee with condensed milk.",
    warrantyNote: "Pha chế tươi mới theo yêu cầu",
    stockCounts: { available: 99, reserved: 0, sold: 450, disabled: 0, total: 549 },
  },
  {
    id: "prod_2",
    categoryId: "cat_2",
    name: "Trà sữa Trân châu Đường đen",
    nameEn: "Black Sugar Boba Milk Tea",
    priceVnd: 45000,
    defaultCostVnd: 18000,
    fulfillmentType: "stock",
    active: true,
    sortOrder: 2,
    description: "Trà ô long thơm ngậy kết hợp trân châu đường đen dẻo giòn.",
    descriptionEn: "Fragrant Oolong milk tea with chewy brown sugar boba.",
    warrantyNote: "Pha chế mới",
    stockCounts: { available: 50, reserved: 2, sold: 310, disabled: 0, total: 362 },
  },
  {
    id: "prod_3",
    categoryId: "cat_2",
    name: "Trà Đào Cam Sả",
    nameEn: "Peach Orange Lemongrass Tea",
    priceVnd: 42000,
    defaultCostVnd: 15000,
    fulfillmentType: "stock",
    active: true,
    sortOrder: 3,
    description: "Trà đen thanh mát quyện cùng đào miếng giòn và vị sả tươi.",
    descriptionEn: "Refreshing black tea infused with peach slices, orange, and lemongrass.",
    warrantyNote: "",
    stockCounts: { available: 40, reserved: 0, sold: 280, disabled: 0, total: 320 },
  },
  {
    id: "prod_4",
    categoryId: "cat_3",
    name: "Sinh tố Bơ Cốt dừa",
    nameEn: "Avocado Coconut Smoothie",
    priceVnd: 50000,
    defaultCostVnd: 20000,
    fulfillmentType: "stock",
    active: true,
    sortOrder: 4,
    description: "Bơ sáp Dăk Lăk béo ngậy xay cùng nước cốt dừa thơm phức.",
    descriptionEn: "Creamy avocado blended with rich coconut cream.",
    warrantyNote: "",
    stockCounts: { available: 20, reserved: 0, sold: 190, disabled: 0, total: 210 },
  },
  {
    id: "prod_5",
    categoryId: "cat_3",
    name: "Nước ép Cam tươi",
    nameEn: "Fresh Orange Juice",
    priceVnd: 38000,
    defaultCostVnd: 14000,
    fulfillmentType: "stock",
    active: true,
    sortOrder: 5,
    description: "Cam sành vắt tươi 100%, không đường bổ sung.",
    descriptionEn: "100% freshly squeezed orange juice.",
    warrantyNote: "",
    stockCounts: { available: 30, reserved: 0, sold: 160, disabled: 0, total: 190 },
  },
  {
    id: "prod_6",
    categoryId: "cat_4",
    name: "Bánh Tiramisu Choco",
    nameEn: "Chocolate Tiramisu Cake",
    priceVnd: 55000,
    defaultCostVnd: 22000,
    fulfillmentType: "stock",
    active: true,
    sortOrder: 6,
    description: "Bánh Ý vị cà phê cacao đắng nhẹ, kem mascarpone béo mịn.",
    descriptionEn: "Classic Italian dessert with espresso, cocoa, and mascarpone cream.",
    warrantyNote: "",
    stockCounts: { available: 12, reserved: 0, sold: 85, disabled: 0, total: 97 },
  },
];

export const stockProducts = products.filter((p) => p.fulfillmentType === "stock");
export const serviceProducts = products.filter((p) => p.fulfillmentType === "manual_upgrade");
export const dealerProducts = products.filter((p) => p.fulfillmentType === "dealer_api");
export const dealerPendingPriceProducts = dealerProducts.filter((p) => p.dealerPriceNeedsReview);

/* ── Dòng kho ── */
export interface StockItem {
  id: string;
  productId: string;
  status: "available" | "reserved" | "sold" | "disabled";
  payload: string;
  costPriceVnd: number;
  importCode: string | null;
  supplierName: string | null;
  createdAt: string;
  editable: boolean;
}

export const stockItems: StockItem[] = [
  { id: "stk_1", productId: "prod_1", status: "available", payload: "netflix.a1@mail.com | Pass@123 | 2FA: 884201", costPriceVnd: 170000, importCode: "NK240815001", supplierName: "Kho License A", createdAt: "2026-08-04T08:40:00", editable: true },
  { id: "stk_2", productId: "prod_1", status: "available", payload: "netflix.b2@mail.com | Quan@456", costPriceVnd: 170000, importCode: "NK240815001", supplierName: "Kho License A", createdAt: "2026-08-04T08:40:00", editable: true },
  { id: "stk_3", productId: "prod_1", status: "available", payload: "netflix.c3@mail.com | MeoMeo789 | 2FA: 112233", costPriceVnd: 170000, importCode: "NK240815001", supplierName: "Kho License A", createdAt: "2026-08-04T08:40:00", editable: true },
  { id: "stk_4", productId: "prod_1", status: "reserved", payload: "netflix.d4@mail.com | Pass@000", costPriceVnd: 170000, importCode: "NK240814001", supplierName: "Kho License A", createdAt: "2026-08-03T15:20:00", editable: false },
  { id: "stk_5", productId: "prod_1", status: "sold", payload: "netflix.e5@mail.com | Xyz@2025", costPriceVnd: 175000, importCode: "NK240812003", supplierName: "Kho License A", createdAt: "2026-08-01T10:05:00", editable: false },
  { id: "stk_6", productId: "prod_8", status: "available", payload: "STEAM-WALLET-100K-8841-5520-1933", costPriceVnd: 82000, importCode: "NK240815002", supplierName: "License Store Pro", createdAt: "2026-08-04T09:10:00", editable: true },
  { id: "stk_7", productId: "prod_8", status: "available", payload: "STEAM-WALLET-100K-9912-0077-4455", costPriceVnd: 82000, importCode: "NK240815002", supplierName: "License Store Pro", createdAt: "2026-08-04T09:10:00", editable: true },
  { id: "stk_8", productId: "prod_4", status: "available", payload: "yt.fam1@mail.com | FamilyPass1 | 2FA: 551188", costPriceVnd: 230000, importCode: "NK240814001", supplierName: "Kho License A", createdAt: "2026-08-03T11:00:00", editable: true },
  { id: "stk_9", productId: "prod_6", status: "available", payload: "grammarly.g1@mail.com | Gram@2026", costPriceVnd: 400000, importCode: "NK240813001", supplierName: "Nguồn lẻ - Zalo", createdAt: "2026-08-02T17:45:00", editable: true },
  { id: "stk_10", productId: "prod_6", status: "sold", payload: "grammarly.h2@mail.com | pass | 2FA: 990011", costPriceVnd: 410000, importCode: "NK240812002", supplierName: "Nguồn lẻ - Zalo", createdAt: "2026-08-01T09:30:00", editable: false },
];

/* ── Nhà cung cấp + phiếu nhập ── */
export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  telegram: string;
  note: string;
  active: boolean;
  totalCostVnd: number;
  quantity: number;
  importCount: number;
}

export const suppliers: Supplier[] = [
  { id: "sup_1", name: "Kho License A", contactName: "Minh", phone: "0912345678", telegram: "@kho_license_a", note: "Chuyên account Netflix, YouTube. Nhập liên tục mỗi tuần.", active: true, totalCostVnd: 46500000, quantity: 312, importCount: 9 },
  { id: "sup_2", name: "License Store Pro", contactName: "Tùng", phone: "0988777666", telegram: "@license_store_pro", note: "Mã thẻ Steam, game. Giá tốt khi mua số lượng lớn.", active: true, totalCostVnd: 28300000, quantity: 240, importCount: 12 },
  { id: "sup_3", name: "Nguồn lẻ - Zalo", contactName: "Chị Hoa", phone: "0900000000", telegram: "", note: "Nhập lẻ theo đơn, chờ 1-2h.", active: true, totalCostVnd: 9800000, quantity: 41, importCount: 4 },
  { id: "sup_4", name: "RacconAI (API)", contactName: "Hệ thống", phone: "", telegram: "@RacconAI_bot", note: "Nguồn API CTV, ví trả trước DLR_...", active: true, totalCostVnd: 12840000, quantity: 89, importCount: 6 },
];

export interface StockImport {
  code: string;
  productName: string;
  supplierName: string | null;
  quantity: number;
  unitCostVnd: number;
  totalCostVnd: number;
  createdAt: string;
  importedBy: string;
}

export const stockImports: StockImport[] = [
  { code: "NK240815001", productName: "Netflix Premium 1 Tháng", supplierName: "Kho License A", quantity: 30, unitCostVnd: 170000, totalCostVnd: 5100000, createdAt: "2026-08-04T08:40:00", importedBy: "admin" },
  { code: "NK240815002", productName: "Steam Wallet 100k", supplierName: "License Store Pro", quantity: 40, unitCostVnd: 82000, totalCostVnd: 3280000, createdAt: "2026-08-04T09:10:00", importedBy: "admin" },
  { code: "NK240814001", productName: "YouTube Premium 6 Tháng", supplierName: "Kho License A", quantity: 10, unitCostVnd: 230000, totalCostVnd: 2300000, createdAt: "2026-08-03T11:00:00", importedBy: "admin" },
  { code: "NK240813001", productName: "Grammarly Premium 1 Năm", supplierName: "Nguồn lẻ - Zalo", quantity: 8, unitCostVnd: 400000, totalCostVnd: 3200000, createdAt: "2026-08-02T17:45:00", importedBy: "admin" },
  { code: "NK240812003", productName: "Netflix Premium 1 Tháng", supplierName: "Kho License A", quantity: 20, unitCostVnd: 175000, totalCostVnd: 3500000, createdAt: "2026-08-01T10:05:00", importedBy: "admin" },
];

/* ── Quản lý Nhân viên F&B ── */
export type StaffRole = "MANAGER" | "WAITER" | "BARISTA";

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  MANAGER: "Quản lý / Chủ quán",
  WAITER: "Nhân viên Phục vụ (Bot)",
  BARISTA: "Nhân viên Pha chế (Bot)",
};

export interface Staff {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  role: StaffRole;
  active: boolean;
  orderCount: number;
  createdAt: string;
}

export const staffMembers: Staff[] = [
  { id: "stf_1", telegramId: "12345678", firstName: "Nguyễn", lastName: "Văn An", username: "nguyenan", phone: "0901234567", role: "MANAGER", active: true, orderCount: 45, createdAt: "2026-01-10T08:00:00" },
  { id: "stf_2", telegramId: "87654321", firstName: "Trần", lastName: "Thị Bình", username: "binhtran", phone: "0912345678", role: "WAITER", active: true, orderCount: 128, createdAt: "2026-02-15T09:30:00" },
  { id: "stf_3", telegramId: "55551111", firstName: "Lê", lastName: "Minh Cường", username: "leminhcuong", phone: "0923456789", role: "BARISTA", active: true, orderCount: 210, createdAt: "2026-03-01T10:00:00" },
  { id: "stf_4", telegramId: "99992222", firstName: "Bùi", lastName: "Ngọc Quỳnh", username: "buingocquynh", phone: "0934567890", role: "WAITER", active: true, orderCount: 84, createdAt: "2026-04-10T14:15:00" },
  { id: "stf_5", telegramId: "44443333", firstName: "Phạm", lastName: "Thu Hà", username: "phamthuha", phone: "0945678901", role: "BARISTA", active: false, orderCount: 62, createdAt: "2026-05-20T11:00:00" },
];

/* ── Đơn hàng ── */
export interface Order {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  deliveredAt?: string;
  amountVnd: number;
  subtotalVnd: number;
  discountVnd: number;
  quantity: number;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  paymentMethod: "qr" | "cash";
  reviewReason?: string;
  adminNote?: string;
  customerInput?: string;
  costVnd: number;
  grossProfitVnd: number;
  productName: string;
  fulfillmentType: FulfillmentType;
  paidAmount: number;
  paymentCount: number;
  user: { telegramId: string; firstName: string; lastName: string; username: string };
}

export const orders: Order[] = [
  { id: "ord_1", code: "BT0001", createdAt: "2026-08-04T10:02:00", expiresAt: "2026-08-04T10:32:00", deliveredAt: "2026-08-04T10:11:00", amountVnd: 125000, subtotalVnd: 125000, discountVnd: 0, quantity: 3, paymentStatus: "PAID", fulfillmentStatus: "DELIVERED", paymentMethod: "qr", costVnd: 50000, grossProfitVnd: 75000, productName: "Cà phê Sữa đá, Trà Đào Cam Sả", fulfillmentType: "stock", paidAmount: 125000, paymentCount: 1, customerInput: "Bàn 04", user: { telegramId: "12345678", firstName: "Nguyễn", lastName: "Văn An", username: "nguyenan" } },
  { id: "ord_2", code: "BT0002", createdAt: "2026-08-04T09:40:00", expiresAt: "2026-08-04T10:10:00", amountVnd: 450000, subtotalVnd: 450000, discountVnd: 0, quantity: 10, paymentStatus: "PAID", fulfillmentStatus: "READY", paymentMethod: "qr", costVnd: 180000, grossProfitVnd: 270000, productName: "Trà sữa Trân châu", fulfillmentType: "stock", paidAmount: 450000, paymentCount: 1, customerInput: "Mang đi", user: { telegramId: "87654321", firstName: "Trần", lastName: "Thị Bình", username: "binhtran" } },
  { id: "ord_3", code: "BT0003", createdAt: "2026-08-04T09:05:00", expiresAt: "2026-08-04T09:35:00", amountVnd: 190000, subtotalVnd: 190000, discountVnd: 0, quantity: 4, paymentStatus: "UNPAID", fulfillmentStatus: "PENDING_PAYMENT", paymentMethod: "cash", costVnd: 75000, grossProfitVnd: 115000, productName: "Sinh tố Bơ Cốt dừa, Nước ép Cam", fulfillmentType: "stock", paidAmount: 0, paymentCount: 0, customerInput: "Bàn 12", user: { telegramId: "55551111", firstName: "Lê", lastName: "Minh Cường", username: "leminhcuong" } },
  { id: "ord_4", code: "BT0004", createdAt: "2026-08-04T08:20:00", expiresAt: "2026-08-04T08:50:00", amountVnd: 55000, subtotalVnd: 55000, discountVnd: 0, quantity: 1, paymentStatus: "UNDERPAID", fulfillmentStatus: "QUEUED", paymentMethod: "qr", reviewReason: "Khách chuyển thiếu 5.000₫", costVnd: 22000, grossProfitVnd: 33000, productName: "Bánh Tiramisu Choco", fulfillmentType: "stock", paidAmount: 50000, paymentCount: 1, customerInput: "Bàn 02", user: { telegramId: "99992222", firstName: "Bùi", lastName: "Ngọc Quỳnh", username: "buingocquynh" } },
  { id: "ord_7", code: "BT0007", createdAt: "2026-08-04T11:20:00", expiresAt: "2026-08-04T11:50:00", amountVnd: 93000, subtotalVnd: 93000, discountVnd: 0, quantity: 2, paymentStatus: "UNPAID", fulfillmentStatus: "PENDING_PAYMENT", paymentMethod: "qr", costVnd: 36000, grossProfitVnd: 57000, productName: "Nước ép Cam tươi, Bánh Tiramisu Choco", fulfillmentType: "stock", paidAmount: 0, paymentCount: 0, customerInput: "Bàn 15", user: { telegramId: "55551111", firstName: "Lê", lastName: "Minh Cường", username: "leminhcuong" } },
  { id: "ord_8", code: "BT0008", createdAt: "2026-08-04T07:45:00", expiresAt: "2026-08-04T08:15:00", deliveredAt: "2026-08-04T07:55:00", amountVnd: 70000, subtotalVnd: 70000, discountVnd: 0, quantity: 2, paymentStatus: "PAID", fulfillmentStatus: "DELIVERED", paymentMethod: "qr", costVnd: 28000, grossProfitVnd: 42000, productName: "Trà Đào Cam Sả, Cà phê Đen", fulfillmentType: "stock", paidAmount: 70000, paymentCount: 1, customerInput: "Bàn 05", user: { telegramId: "88889999", firstName: "Hoàng", lastName: "Gia Bảo", username: "hoanggiabao" } },
  { id: "ord_9", code: "BT0009", createdAt: "2026-08-03T20:15:00", expiresAt: "2026-08-03T20:45:00", amountVnd: 120000, subtotalVnd: 120000, discountVnd: 0, quantity: 3, paymentStatus: "PAID", fulfillmentStatus: "DELIVERED", paymentMethod: "cash", costVnd: 48000, grossProfitVnd: 72000, productName: "Cà phê Sữa đá", fulfillmentType: "stock", paidAmount: 120000, paymentCount: 1, customerInput: "Bàn 01", user: { telegramId: "77776666", firstName: "Vũ", lastName: "Đức Dũng", username: "vuducdung" } },
  { id: "ord_10", code: "BT0010", createdAt: "2026-08-03T18:00:00", expiresAt: "2026-08-03T18:30:00", amountVnd: 160000, subtotalVnd: 160000, discountVnd: 0, quantity: 4, paymentStatus: "PAID", fulfillmentStatus: "DELIVERED", paymentMethod: "qr", costVnd: 64000, grossProfitVnd: 96000, productName: "Sinh tố Bơ, Nước ép Cam", fulfillmentType: "stock", paidAmount: 160000, paymentCount: 1, customerInput: "Mang đi", user: { telegramId: "12345678", firstName: "Nguyễn", lastName: "Văn An", username: "nguyenan" } },
  { id: "ord_5", code: "BT0005", createdAt: "2026-08-03T21:30:00", expiresAt: "2026-08-03T22:00:00", deliveredAt: "2026-08-03T21:41:00", amountVnd: 85000, subtotalVnd: 85000, discountVnd: 0, quantity: 2, paymentStatus: "PAID", fulfillmentStatus: "DELIVERED", paymentMethod: "cash", costVnd: 35000, grossProfitVnd: 50000, productName: "Cà phê Sữa đá, Sinh tố Bơ", fulfillmentType: "stock", paidAmount: 85000, paymentCount: 1, customerInput: "Mang đi", user: { telegramId: "44443333", firstName: "Phạm", lastName: "Thu Hà", username: "phamthuha" } },
  { id: "ord_6", code: "BT0006", createdAt: "2026-08-03T19:10:00", expiresAt: "2026-08-03T19:40:00", amountVnd: 90000, subtotalVnd: 95000, discountVnd: 5000, quantity: 2, paymentStatus: "REFUNDED", fulfillmentStatus: "CANCELLED", paymentMethod: "qr", costVnd: 40000, grossProfitVnd: 50000, productName: "Trà sữa Trân châu Đường đen, Sinh tố Bơ Cốt dừa", fulfillmentType: "stock", paidAmount: 0, paymentCount: 1, customerInput: "Bàn 07", user: { telegramId: "12345678", firstName: "Nguyễn", lastName: "Văn An", username: "nguyenan" } },
];

/* ── Giao dịch thanh toán ── */
export interface Payment {
  id: string;
  code: string;
  type: PaymentType;
  sepayId: string | null;
  amountExpected: number;
  amountReceived: number;
  status: PaymentStatus;
  note?: string;
  createdAt: string;
  user: { telegramId: string; username: string };
  orderCode?: string;
}

export const payments: Payment[] = [
  { id: "pay_1", code: "BT0001", type: "order", sepayId: "SP8821401", amountExpected: 125000, amountReceived: 125000, status: "matched", createdAt: "2026-08-04T10:11:00", user: { telegramId: "12345678", username: "nguyenan" }, orderCode: "BT0001" },
  { id: "pay_2", code: "BT0002", type: "order", sepayId: "SP8821502", amountExpected: 450000, amountReceived: 450000, status: "matched", createdAt: "2026-08-04T09:41:00", user: { telegramId: "87654321", username: "binhtran" }, orderCode: "BT0002" },
  { id: "pay_3", code: "BT0004", type: "order", sepayId: "SP8821603", amountExpected: 55000, amountReceived: 50000, status: "underpaid", note: "Chênh 5.000₫ — đang chờ khách bổ sung", createdAt: "2026-08-04T08:22:00", user: { telegramId: "99992222", username: "buingocquynh" }, orderCode: "BT0004" },
  { id: "pay_4", code: "NAP0005", type: "topup", sepayId: "SP8821704", amountExpected: 500000, amountReceived: 500000, status: "matched", createdAt: "2026-08-04T07:55:00", user: { telegramId: "44443333", username: "phamthuha" } },
  { id: "pay_5", code: "BT0008", type: "order", sepayId: "SP8819805", amountExpected: 85000, amountReceived: 85000, status: "duplicate", note: "Webhook nhận 2 lần cùng mã giao dịch", createdAt: "2026-08-02T14:27:00", user: { telegramId: "88889999", username: "hoanggiabao" }, orderCode: "BT0008" },
  { id: "pay_6", code: "BT0012", type: "order", sepayId: "SP8817906", amountExpected: 65000, amountReceived: 65000, status: "matched", createdAt: "2026-08-01T15:14:00", user: { telegramId: "12345678", username: "nguyenan" }, orderCode: "BT0012" },
  { id: "pay_7", code: "UNKN_0001", type: "manual", sepayId: "SP8801011", amountExpected: 0, amountReceived: 45000, status: "unknown_code", note: "Nội dung chuyển khoản không khớp mã nào", createdAt: "2026-07-31T18:02:00", user: { telegramId: "-", username: "" } },
  { id: "pay_8", code: "NAP0012", type: "topup", sepayId: "SP8799012", amountExpected: 300000, amountReceived: 300000, status: "matched", createdAt: "2026-07-31T09:30:00", user: { telegramId: "77776666", username: "vuducdung" } },
  { id: "pay_9", code: "BT0015", type: "order", sepayId: "SP8798013", amountExpected: 70000, amountReceived: 80000, status: "overpaid", note: "Thừa 10.000₫ — đã cộng dư vào ví khách", createdAt: "2026-07-30T16:44:00", user: { telegramId: "12345678", username: "nguyenan" }, orderCode: "BT0015" },
  { id: "pay_10", code: "BT0009", type: "order", sepayId: "SP8797014", amountExpected: 190000, amountReceived: 0, status: "failed", note: "Giao dịch bị ngân hàng từ chối", createdAt: "2026-07-29T11:20:00", user: { telegramId: "55551111", username: "leminhcuong" }, orderCode: "BT0009" },
];

/* ── Bảo hành ── */
export interface Warranty {
  id: string;
  code: string;
  status: string;
  priority: "normal" | "high" | "urgent";
  reason: string;
  description: string;
  adminNote?: string;
  createdAt: string;
  handledBy: string | null;
  orderCode: string;
  productName: string;
  productFulfillment: FulfillmentType;
  orderAmountVnd: number;
  user: { telegramId: string; username: string };
  resolution?: "replacement" | "wallet_refund";
  replacementCostVnd?: number;
  refundAmountVnd?: number;
}

export const warranties: Warranty[] = [
  { id: "war_1", code: "BH240815001", status: "open", priority: "urgent", reason: "Tài khoản không đăng nhập được", description: "Khách phản ánh account Netflix lỗi sai mật khẩu sau 2 giờ nhận hàng.", createdAt: "2026-08-04T10:30:00", handledBy: null, orderCode: "BT240815001", productName: "Netflix Premium 1 Tháng", productFulfillment: "stock", orderAmountVnd: 250000, user: { telegramId: "12345678", username: "nguyenan" } },
  { id: "war_2", code: "BH240815002", status: "processing", priority: "normal", reason: "Account bị đổi region", description: "ChatGPT Plus trả về region Mỹ thay vì Việt Nam.", createdAt: "2026-08-04T08:15:00", handledBy: "admin", orderCode: "BT240815002", productName: "ChatGPT Plus 1 Tháng", productFulfillment: "manual_upgrade", orderAmountVnd: 450000, user: { telegramId: "87654321", username: "binhtran" } },
  { id: "war_3", code: "BH240814003", status: "waiting_customer", priority: "normal", reason: "Hết hạn sớm hơn cam kết", description: "Grammarly hết hạn sau 10 tháng thay vì 12 tháng.", adminNote: "Đã yêu cầu khách gửi ảnh chụp ngày hết hạn.", createdAt: "2026-08-03T22:10:00", handledBy: "admin", orderCode: "BT240814005", productName: "Grammarly Premium 1 Năm", productFulfillment: "stock", orderAmountVnd: 550000, user: { telegramId: "44443333", username: "phamthuha" } },
  { id: "war_4", code: "BH240812004", status: "resolved", priority: "high", reason: "Account bị khoá do chia sẻ quá nhiều", description: "Khách chia sẻ mật khẩu cho 6 người dùng cùng lúc nên account bị Netflix khoá.", createdAt: "2026-08-01T17:00:00", handledBy: "admin", orderCode: "BT240812012", productName: "Netflix Premium 1 Tháng", productFulfillment: "stock", orderAmountVnd: 250000, user: { telegramId: "12345678", username: "nguyenan" }, resolution: "replacement", replacementCostVnd: 180000 },
  { id: "war_5", code: "BH240810005", status: "rejected", priority: "normal", reason: "Không đủ điều kiện bảo hành", description: "Khách tự đổi mật khẩu và mất quyền kiểm soát account.", adminNote: "Theo chính sách, tự ý đổi mật khẩu không được bảo hành.", createdAt: "2026-07-30T09:20:00", handledBy: "admin", orderCode: "BT240729009", productName: "Steam Wallet 100k", productFulfillment: "stock", orderAmountVnd: 95000, user: { telegramId: "55551111", username: "leminhcuong" } },
];

/* ── Broadcast ── */
export interface Campaign {
  id: string;
  title: string;
  target: string;
  status: string;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  createdAt: string;
  createdBy: string;
  lastError?: string;
}

export const campaigns: Campaign[] = [
  { id: "cmp_1", title: "KM cuối tuần 20/08 — giảm 15% gói Netflix", target: "all", status: "completed", sentCount: 483, failedCount: 3, scheduledAt: null, createdAt: "2026-08-02T09:00:00", createdBy: "admin" },
  { id: "cmp_2", title: "Ra mắt gói ChatGPT Plus — nhận ngay voucher", target: "vi", status: "queued", sentCount: 0, failedCount: 0, scheduledAt: "2026-08-05T08:00:00", createdAt: "2026-08-04T09:30:00", createdBy: "admin" },
  { id: "cmp_3", title: "Nhắc ví: còn dư 500k chưa dùng", target: "wallet", status: "draft", sentCount: 0, failedCount: 0, scheduledAt: null, createdAt: "2026-08-03T14:00:00", createdBy: "admin" },
  { id: "cmp_4", title: "Chương trình tháng 7 — tặng Steam 100k", target: "customers", status: "failed", sentCount: 112, failedCount: 21, scheduledAt: null, createdAt: "2026-07-25T10:00:00", createdBy: "admin", lastError: "Telegram rate limit exceeded — retry later" },
];

export const audience = { all: 485, vi: 480, customers: 143, wallet: 38, inactive30: 61 };

/* ── Nhật ký ── */
export interface AuditLog {
  id: string;
  createdAt: string;
  actor: string;
  actionLabel: string;
  entity: string;
  entityId: string;
  metadataPreview: string;
}

export const auditLogs: AuditLog[] = [
  { id: "log_1", createdAt: "2026-08-04T10:35:00", actor: "bot_waiter", actionLabel: "Tạo đơn hàng mới", entity: "Order", entityId: "BT240815001", metadataPreview: "{ table: 'Bàn 04', item: 'Trà sữa Trân châu', payment: 'QR' }" },
  { id: "log_2", createdAt: "2026-08-04T10:11:00", actor: "sepay_system", actionLabel: "Đối soát SePay tự động", entity: "Payment", entityId: "SP8821401", metadataPreview: "{ status: 'matched', amount: 250000 }" },
  { id: "log_3", createdAt: "2026-08-04T09:42:00", actor: "bot_barista", actionLabel: "Pha chế hoàn tất", entity: "Order", entityId: "BT240815002", metadataPreview: "{ status: 'READY', timeToMake: '4 mins' }" },
  { id: "log_4", createdAt: "2026-08-04T09:05:00", actor: "nguyenan", actionLabel: "Xác nhận thu Tiền mặt", entity: "Order", entityId: "BT240815003", metadataPreview: "{ collector: 'nguyenan', amount: 190000 }" },
  { id: "log_5", createdAt: "2026-08-04T08:20:00", actor: "sepay_system", actionLabel: "Cảnh báo chuyển thiếu tiền", entity: "Payment", entityId: "SP8821603", metadataPreview: "{ expected: 500000, received: 480000 }" },
  { id: "log_6", createdAt: "2026-08-03T16:00:00", actor: "admin", actionLabel: "Cập nhật Thực đơn", entity: "Product", entityId: "prod_1", metadataPreview: "{ name: 'Cà phê Sữa đá', price: 35000 }" },
  { id: "log_7", createdAt: "2026-08-03T14:30:00", actor: "admin", actionLabel: "Thêm nhân viên mới", entity: "Staff", entityId: "stf_4", metadataPreview: "{ name: 'Bùi Ngọc Quỳnh', role: 'WAITER' }" },
];

/* ── Dashboard ── */
export const dashboardStats = {
  salesAmount: 154500000,
  todayRevenue: 12500000,
  revenueOrders: 142,
  purchaseCost: 89000000,
  inventoryValue: 35000000,
  costOfGoods: 82000000,
  grossProfit: 72500000,
  profitMargin: "46.9",
};

export const revenueChartPoints = [
  { label: "Thứ 2", revenueVnd: 18000000, orderCount: 15, heightPct: 72 },
  { label: "Thứ 3", revenueVnd: 22000000, orderCount: 20, heightPct: 88 },
  { label: "Thứ 4", revenueVnd: 15000000, orderCount: 14, heightPct: 60 },
  { label: "Thứ 5", revenueVnd: 19000000, orderCount: 18, heightPct: 76 },
  { label: "Thứ 6", revenueVnd: 21000000, orderCount: 22, heightPct: 84 },
  { label: "Thứ 7", revenueVnd: 24000000, orderCount: 25, heightPct: 96 },
  { label: "Chủ Nhật", revenueVnd: 25000000, orderCount: 28, heightPct: 100 },
];

export const dashboardHealth = {
  pending: 3,
  needsReviewOrders: 1,
  paymentNeedsReview: 3,
  lowStock: 2,
  outOfStock: 1,
  openWarranties: 1,
  queuedBroadcasts: 1,
  users: 485,
  orders: 142,
  stock: 158,
  walletBalance: 12400000,
};

export const recentOrders = orders.slice(0, 6);
export const attentionProducts = [
  { id: "prod_4", name: "YouTube Premium 6 Tháng", category: "Giải trí", available: 0 },
  { id: "prod_6", name: "Grammarly Premium 1 Năm", category: "Học tập", available: 5 },
];
export const recentImportHighlights = stockImports.slice(0, 3);
export const recentPaymentAlerts = payments.filter((p) => ["underpaid", "unknown_code", "failed"].includes(p.status)).slice(0, 3);

/* ── Dealer API ── */
export const dealerApi = {
  enabled: true,
  balance: 5240000,
  upstreamProductCount: 38,
  linkedProductCount: 3,
  baseUrl: "http://103.75.186.223:5000",
  priceSyncHours: 6,
  sources: [
    { id: "src_1", name: "Cixipi Premium", dealerName: "Cixipi", baseUrl: "http://103.75.186.223:5000", maskedApiKey: "DLR_•••••••x9K2", lastBalanceVnd: 3820000, linkedProductCount: 2, openOrderCount: 0 },
    { id: "src_2", name: "RacconAI", dealerName: "Raccon", baseUrl: "http://103.75.186.223:5000", maskedApiKey: "DLR_•••••••a1B8", lastBalanceVnd: 1420000, linkedProductCount: 1, openOrderCount: 1 },
  ],
};

export const dealerUpstreamProducts = [
  { key: "netflix-premium-1y", name: "Netflix Premium 1 Năm", type: "stock", apiPriceVnd: 1800000, sourcePriceVnd: 1800000, stock: 45, markupPercent: 20, imported: true, active: true },
  { key: "chatgpt-plus-1m", name: "ChatGPT Plus 1 Tháng", type: "stock", apiPriceVnd: 420000, sourcePriceVnd: 420000, stock: 32, markupPercent: 20, imported: true, active: true },
  { key: "spotify-premium-1y", name: "Spotify Premium 1 Năm", type: "stock", apiPriceVnd: 350000, sourcePriceVnd: 350000, stock: 18, markupPercent: 20, imported: true, active: true },
  { key: "youtube-premium-1y", name: "YouTube Premium 1 Năm", type: "stock", apiPriceVnd: 680000, sourcePriceVnd: 680000, stock: 27, markupPercent: 20, imported: false, active: false },
  { key: "claude-pro-1m", name: "Claude Pro 1 Tháng", type: "stock", apiPriceVnd: 400000, sourcePriceVnd: 400000, stock: 0, markupPercent: 20, imported: false, active: false },
  { key: "canva-pro-1y", name: "Canva Pro 1 Năm", type: "stock", apiPriceVnd: 300000, sourcePriceVnd: 300000, stock: 54, markupPercent: 20, imported: false, active: false },
];

/* ── Cấu hình ── */
export const settings = {
  shopName: "Bot Tele",
  publicBaseUrl: "https://bot-qlct.example.vn",
  isLocalPublicBaseUrl: false,
  telegramWebhookUrl: "https://bot-qlct.example.vn/telegram/webhook/0f4b2d8c...",
  sepayMode: "api" as "pg" | "api" | "hook",
  sepayEnv: "production",
  sepayWebhookUrl: "https://bot-qlct.example.vn/webhooks/sepay",
  sepayIpnUrl: "https://bot-qlct.example.vn/webhooks/sepay-ipn",
  adminBotConfigured: true,
  adminBotUsername: "@bot_tele_admin",
  adminChatCount: 2,
  supportContact: "@support",
  supportZalo: "0900000000",
};

/* ============================================================
   Chi tiết đơn (Trang chi tiết đơn) — build từ orders[] sẵn có
   ============================================================ */

export interface OrderItem {
  id: string;
  productId: string;
  productName: string; // snapshot tên tại thời điểm đặt
  nameEn?: string;
  unitPriceVnd: number; // snapshot giá
  quantity: number;
  lineTotalVnd: number; // unitPriceVnd * quantity
}

export type OrderTimelineEventStatus =
  | OrderFulfillmentStatus
  | "ORDER_CREATED"
  | "CANCELLED"
  | "REFUNDED"
  | "PAID"
  | "UNDERPAID"
  | "OVERPAID";

export interface OrderTimelineEvent {
  id: string;
  status: OrderTimelineEventStatus;
  label: string; // hiển thị
  at: string; // ISO
  by?: string; // người thực hiện
  note?: string;
}

export interface OrderDetail {
  id: string;
  code: string;
  createdAt: string;
  expiresAt?: string;
  deliveredAt?: string;
  items: OrderItem[]; // snapshot món
  subtotalVnd: number; // tổng items (backend tự tính)
  discountVnd: number;
  totalVnd: number; // subtotal - discount
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  paymentMethod: "qr" | "cash";
  paidAmount: number;
  user: { telegramId: string; firstName: string; lastName: string; username: string };
  customerInput?: string; // ghi chú/bàn
  timeline: OrderTimelineEvent[]; // lịch sử trạng thái
}

/** Chuyển ISO sang ISO sau n phút (dùng cho timeline giả lập). */
function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

/** Tách danh sách món từ chuỗi productName + giá snapshot khớp subtotal của đơn. */
function buildOrderItems(order: Order): OrderItem[] {
  const names = order.productName
    .split(",")
    .map((n) => n.trim().replace(/^\d+x\s+/i, ""))
    .filter(Boolean);
  const count = names.length || 1;
  let remaining = order.quantity;
  const quantities = names.map((_, i) => {
    if (i === names.length - 1) return Math.max(0, remaining);
    const q = Math.max(1, Math.floor(order.quantity / count));
    remaining -= q;
    return q;
  });

  const unitPrices = names.map((name) => {
    const product = products.find((p) => p.name === name || p.name.startsWith(name));
    return product?.priceVnd ?? Math.round(order.subtotalVnd / order.quantity);
  });

  // Điều chỉnh giá món cuối để tổng thành tiền khớp đúng subtotal (giá snapshot khi đặt).
  const currentSum = unitPrices.reduce((s, p, i) => s + p * quantities[i], 0);
  const diff = order.subtotalVnd - currentSum;
  const lastIdx = unitPrices.length - 1;
  if (quantities[lastIdx] > 0) {
    unitPrices[lastIdx] = Math.max(0, Math.round(unitPrices[lastIdx] + diff / quantities[lastIdx]));
  }

  return names.map((name, i) => {
    const product = products.find((p) => p.name === name || p.name.startsWith(name));
    return {
      id: `${order.id}_item${i + 1}`,
      productId: product?.id ?? `prod_x_${i + 1}`,
      productName: name,
      nameEn: product?.nameEn,
      unitPriceVnd: unitPrices[i],
      quantity: quantities[i],
      lineTotalVnd: unitPrices[i] * quantities[i],
    };
  });
}

/** Tự sinh timeline trạng thái dựa trên payment/fulfillment status của đơn. */
function buildOrderTimeline(order: Order): OrderTimelineEvent[] {
  const actor = `${order.user.firstName} ${order.user.lastName}`;
  const events: OrderTimelineEvent[] = [];
  let seq = 0;
  const ev = (status: OrderTimelineEventStatus, label: string, at: string, by?: string, note?: string): OrderTimelineEvent => ({
    id: `${order.id}-e${++seq}`,
    status,
    label,
    at,
    by,
    note,
  });

  events.push(ev("ORDER_CREATED", "Khách tạo đơn", order.createdAt, actor, order.customerInput));

  if (order.fulfillmentStatus === "CANCELLED") {
    events.push(ev("CANCELLED", "Hủy đơn", order.expiresAt, "admin", order.adminNote ?? "Khách không thanh toán đúng hạn"));
    if (order.paymentStatus === "REFUNDED") {
      events.push(ev("REFUNDED", `Hoàn tiền ${formatVnd(order.amountVnd)}`, order.expiresAt, "admin", "Hoàn toàn bộ số tiền đã thanh toán"));
    }
    return events;
  }

  const paidNote =
    order.paymentMethod === "cash"
      ? `Thu tiền mặt ${formatVnd(order.paidAmount)}`
      : `Chuyển khoản QR ${formatVnd(order.paidAmount)}`;

  switch (order.paymentStatus) {
    case "PAID":
      events.push(ev("PAID", "Thanh toán thành công", plusMinutes(order.createdAt, 7), actor, paidNote));
      break;
    case "UNDERPAID":
      events.push(ev("UNDERPAID", "Thanh toán thiếu", plusMinutes(order.createdAt, 7), actor, `${paidNote} — thiếu ${formatVnd(order.amountVnd - order.paidAmount)}`));
      break;
    case "OVERPAID":
      events.push(ev("OVERPAID", "Thanh toán thừa", plusMinutes(order.createdAt, 7), actor, `${paidNote} — thừa ${formatVnd(order.paidAmount - order.amountVnd)}`));
      break;
    case "REFUNDED":
      events.push(ev("PAID", "Thanh toán thành công", plusMinutes(order.createdAt, 7), actor, paidNote));
      events.push(ev("REFUNDED", `Hoàn tiền ${formatVnd(order.amountVnd)}`, plusMinutes(order.createdAt, 45), "admin", "Hoàn tiền theo yêu cầu khách"));
      break;
    default:
      events.push(
        ev(
          "PENDING_PAYMENT",
          "Chờ thanh toán",
          plusMinutes(order.createdAt, 5),
          "system",
          order.paymentMethod === "qr" ? "Đang chờ chuyển khoản QR" : "Đang chờ thu tiền mặt"
        )
      );
  }

  switch (order.fulfillmentStatus) {
    case "QUEUED":
      events.push(ev("QUEUED", "Vào hàng chờ", plusMinutes(order.createdAt, 8), "bot_barista", "Xếp hàng pha chế"));
      break;
    case "PREPARING":
      events.push(ev("QUEUED", "Vào hàng chờ", plusMinutes(order.createdAt, 8), "bot_barista"));
      events.push(ev("PREPARING", "Bắt đầu pha chế", plusMinutes(order.createdAt, 10), "bot_barista"));
      break;
    case "READY":
      events.push(ev("QUEUED", "Vào hàng chờ", plusMinutes(order.createdAt, 8), "bot_barista"));
      events.push(ev("PREPARING", "Pha chế xong", plusMinutes(order.createdAt, 12), "bot_barista"));
      events.push(ev("READY", "Sẵn sàng giao", plusMinutes(order.createdAt, 14), "bot_barista", order.customerInput === "Mang đi" ? "Chờ khách nhận hoặc giao" : "Gọi khách nhận tại quầy"));
      break;
    case "DELIVERED":
      events.push(ev("QUEUED", "Vào hàng chờ", plusMinutes(order.createdAt, 8), "bot_barista"));
      events.push(ev("PREPARING", "Pha chế xong", plusMinutes(order.createdAt, 12), "bot_barista"));
      events.push(ev("READY", "Sẵn sàng giao", plusMinutes(order.createdAt, 14), "bot_barista"));
      events.push(ev("DELIVERED", "Đã giao", order.deliveredAt ?? plusMinutes(order.createdAt, 16), "bot_waiter", "Khách đã nhận"));
      break;
    default:
      break;
  }

  return events;
}

/** Map một Order sang OrderDetail đầy đủ (items + timeline tự sinh). */
export function buildOrderDetail(order: Order): OrderDetail {
  const items = buildOrderItems(order);
  const subtotalVnd = items.reduce((s, i) => s + i.lineTotalVnd, 0);
  return {
    id: order.id,
    code: order.code,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    deliveredAt: order.deliveredAt,
    items,
    subtotalVnd,
    discountVnd: order.discountVnd,
    totalVnd: subtotalVnd - order.discountVnd,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentMethod: order.paymentMethod,
    paidAmount: order.paidAmount,
    user: order.user,
    customerInput: order.customerInput,
    timeline: buildOrderTimeline(order),
  };
}

export const orderDetails: OrderDetail[] = orders.map(buildOrderDetail);

/* ── Nhãn trạng thái timeline ── */
export const TIMELINE_STATUS_LABEL: Record<OrderTimelineEventStatus, string> = {
  ...ORDER_FULFILLMENT_STATUS_LABEL,
  ORDER_CREATED: "Tạo đơn",
  CANCELLED: "Đã hủy",
  REFUNDED: "Hoàn tiền",
  PAID: "Đã thanh toán",
  UNDERPAID: "Thiếu tiền",
  OVERPAID: "Thừa tiền",
};

/* ============================================================
   Đối soát SePay (Trang Đối soát)
   ============================================================ */

export type ReconciliationClassification =
  | "matched" // đúng tiền
  | "underpaid" // thiếu tiền
  | "overpaid" // thừa tiền
  | "unknown_code" // sai mã
  | "duplicate"; // trùng lặp webhook

export interface Reconciliation {
  id: string;
  code: string; // mã giao dịch SePay
  orderCode?: string; // đơn liên quan (nếu có)
  sepayId: string;
  amountExpected: number;
  amountReceived: number;
  classification: ReconciliationClassification;
  reason: string; // lý do phân loại
  status: "open" | "resolved"; // đã xử lý chưa
  resolvedBy?: string;
  resolvedAt?: string;
  resolveNote?: string; // ghi chú xử lý
  createdAt: string;
}

export const RECONCILIATION_CLASSIFICATION_LABEL: Record<ReconciliationClassification, string> = {
  matched: "Đúng tiền",
  underpaid: "Thiếu tiền",
  overpaid: "Thừa tiền",
  unknown_code: "Sai mã",
  duplicate: "Trùng lặp",
};

export const RECONCILIATION_STATUS_LABEL: Record<Reconciliation["status"], string> = {
  open: "Chưa xử lý",
  resolved: "Đã xử lý",
};

export const reconciliations: Reconciliation[] = [
  { id: "rec_1", code: "SP8821401", orderCode: "BT0001", sepayId: "8821401", amountExpected: 125000, amountReceived: 125000, classification: "matched", reason: "Số tiền khớp đúng với đơn BT0001.", status: "resolved", resolvedBy: "system", resolvedAt: "2026-08-04T10:15:00", createdAt: "2026-08-04T10:11:00" },
  { id: "rec_2", code: "SP8821502", orderCode: "BT0002", sepayId: "8821502", amountExpected: 450000, amountReceived: 450000, classification: "matched", reason: "Số tiền khớp đúng với đơn BT0002.", status: "resolved", resolvedBy: "system", resolvedAt: "2026-08-04T09:43:00", createdAt: "2026-08-04T09:41:00" },
  { id: "rec_3", code: "SP8821603", orderCode: "BT0004", sepayId: "8821603", amountExpected: 55000, amountReceived: 50000, classification: "underpaid", reason: "Khách chuyển thiếu 5.000₫ so với đơn BT0004. Đang chờ khách bổ sung.", status: "open", createdAt: "2026-08-04T08:22:00" },
  { id: "rec_4", code: "SP8819805", orderCode: "BT0008", sepayId: "8819805", amountExpected: 85000, amountReceived: 85000, classification: "duplicate", reason: "SePay gửi webhook 2 lần cho cùng giao dịch, chỉ tính 1 lần.", status: "open", createdAt: "2026-08-02T14:27:00" },
  { id: "rec_5", code: "SP8801011", orderCode: undefined, sepayId: "8801011", amountExpected: 0, amountReceived: 45000, classification: "unknown_code", reason: "Nội dung chuyển khoản không khớp mã đơn nào đang chờ.", status: "open", createdAt: "2026-07-31T18:02:00" },
  { id: "rec_6", code: "SP8798013", orderCode: "BT0015", sepayId: "8798013", amountExpected: 70000, amountReceived: 80000, classification: "overpaid", reason: "Khách chuyển thừa 10.000₫, đã cộng dư vào ví khách.", status: "open", createdAt: "2026-07-30T16:44:00" },
  { id: "rec_7", code: "SP8797014", orderCode: "BT0009", sepayId: "8797014", amountExpected: 190000, amountReceived: 0, classification: "unknown_code", reason: "Giao dịch bị ngân hàng từ chối, không nhận được tiền.", status: "resolved", resolvedBy: "admin", resolvedAt: "2026-07-29T12:05:00", createdAt: "2026-07-29T11:20:00" },
];

/* ============================================================
   Báo cáo doanh thu (Trang Báo cáo)
   ============================================================ */

export type RevenueMethod = "cash" | "qr";

export interface RevenueDayRow {
  date: string; // "2026-08-01"
  cashVnd: number; // doanh thu tiền mặt
  qrVnd: number; // doanh thu chuyển khoản
  refundedVnd: number; // hoàn tiền (KHÔNG tính vào doanh thu thuần)
  orderCount: number;
}

export const revenueDays: RevenueDayRow[] = [
  { date: "2026-07-20", cashVnd: 3200000, qrVnd: 4100000, refundedVnd: 0, orderCount: 18 },
  { date: "2026-07-21", cashVnd: 2750000, qrVnd: 5600000, refundedVnd: 120000, orderCount: 21 },
  { date: "2026-07-22", cashVnd: 4100000, qrVnd: 4850000, refundedVnd: 0, orderCount: 24 },
  { date: "2026-07-23", cashVnd: 3350000, qrVnd: 3920000, refundedVnd: 0, orderCount: 19 },
  { date: "2026-07-24", cashVnd: 4680000, qrVnd: 6100000, refundedVnd: 95000, orderCount: 28 },
  { date: "2026-07-25", cashVnd: 5230000, qrVnd: 7480000, refundedVnd: 0, orderCount: 33 },
  { date: "2026-07-26", cashVnd: 6100000, qrVnd: 6920000, refundedVnd: 0, orderCount: 31 },
  { date: "2026-07-27", cashVnd: 2980000, qrVnd: 4550000, refundedVnd: 210000, orderCount: 22 },
  { date: "2026-07-28", cashVnd: 3870000, qrVnd: 5340000, refundedVnd: 0, orderCount: 25 },
  { date: "2026-07-29", cashVnd: 3420000, qrVnd: 4910000, refundedVnd: 0, orderCount: 23 },
  { date: "2026-07-30", cashVnd: 4560000, qrVnd: 6230000, refundedVnd: 78000, orderCount: 29 },
  { date: "2026-07-31", cashVnd: 5840000, qrVnd: 7210000, refundedVnd: 0, orderCount: 34 },
  { date: "2026-08-01", cashVnd: 6720000, qrVnd: 8050000, refundedVnd: 150000, orderCount: 39 },
  { date: "2026-08-02", cashVnd: 5470000, qrVnd: 6630000, refundedVnd: 0, orderCount: 35 },
  { date: "2026-08-03", cashVnd: 4890000, qrVnd: 7120000, refundedVnd: 0, orderCount: 32 },
];

/* ============================================================
   Dashboard — nguồn truy cập + thời gian hoạt động máy chủ
   ============================================================ */

export interface TrafficSource {
  label: string;
  percent: number;
  color: string; // hex — dùng trực tiếp cho biểu đồ donut
}

export const trafficSources: TrafficSource[] = [
  { label: "Trực tiếp", percent: 38, color: "#16a34a" },
  { label: "Tìm kiếm", percent: 32, color: "#86efac" },
  { label: "Mạng xã hội", percent: 20, color: "#fbbf24" },
  { label: "Khác", percent: 10, color: "#e2e8f0" },
];

export const serverUptime = {
  percent: 99.9,
  label: "30 ngày qua",
  // mốc thời gian để đồng hồ uptime đếm từ đó (giả lập)
  sinceIso: "2026-08-04T00:00:00",
  events: [
    { label: "Không có sự cố nào trong 30 ngày qua", tone: "green" },
    { label: "Lần gần nhất: 2026-07-31 (bảo trì định kỳ)", tone: "muted" },
  ],
} as const;
