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

// A interface SQSMessage é usada pelo handler Lambda e pelo OrderService.
// O evento SQS é recebido diretamente pelo Lambda, sem polling manual.
