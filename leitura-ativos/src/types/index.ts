
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

export interface CreateOrderInput {
    userId: string;
    symbol: string;
    type: OrderType;
    quantity: number;
    price: number;
}

export interface QuotationService {
    getPrice(symbol: string): Promise<number>;
}