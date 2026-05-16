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
