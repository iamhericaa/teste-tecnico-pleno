/**
 * Tipos compartilhados da aplicação
 */

export enum OrderStatus {
  PENDENTE = "PENDENTE",
  PROCESSANDO = "PROCESSANDO",
  EXECUTADA = "EXECUTADA",
  REJEITADA = "REJEITADA",
  CANCELADA = "CANCELADA",
}

export enum OrderType {
  COMPRA = "COMPRA",
  VENDA = "VENDA",
}


export interface SQSMessage {
  orderId: number;
  userId: string;
  symbol: string;
  type: "COMPRA" | "VENDA";
  quantity: number;
  price: number;
  status: "PENDENTE" | "CANCELADA";
  timestamp: string;
}
