export type OrderType = "COMPRA" | "VENDA";
export type OrderStatus = "PENDENTE" | "PROCESSANDO" | "EXECUTADA" | "REJEITADA" | "CANCELADA";

export interface Order {
  id: number;
  user_id: string;
  symbol: string;
  type: OrderType;
  quantity: number;
  price: number;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderRequest {
  userId: string;
  symbol: string;
  type: OrderType;
  quantity: number;
  price: number;
}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  orderId?: number;
  status?: OrderStatus;
}

export interface UserBalance {
  userId: string;
  cash: number; // Saldo em dinheiro
  assets: Record<string, number>; // Saldo por ativo
}