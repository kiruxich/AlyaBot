import type { ModeId, ReplyId } from "./catalog";

export type RequestStatus = "pending" | "accepted" | "done" | "ignored";

export type Req = {
  id: string;
  /** id из каталога, "custom" или "coupon". */
  kind: string;
  emoji: string;
  title: string;
  option?: string;
  text?: string;
  location?: { lat: number; lon: number };
  status: RequestStatus;
  reply?: ReplyId;
  createdAt: number;
  updatedAt: number;
  /** id сообщения-уведомления, чтобы его редактировать. */
  messageId?: number;
  nags: number;
  lastNagAt?: number;
};

export type Coupon = { id: string; title: string; createdAt: number; usedAt?: number };

export type Wish = {
  id: string;
  title: string;
  url?: string;
  note?: string;
  createdAt: number;
  /** Видно только ему. */
  reserved?: boolean;
};

export type State = {
  mood?: number;
  moodAt?: number;
  modes: Partial<Record<ModeId, number>>;
};

export type AppData = {
  role: "owner" | "her";
  name: string;
  state: State;
  requests: Req[];
  coupons: Coupon[];
  wishlist: Wish[];
};
