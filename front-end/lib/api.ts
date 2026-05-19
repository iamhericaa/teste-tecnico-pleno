import axios from 'axios';
import type { UserId } from './useSelectedUser';

const LEITURA_API_BASE_URL =
  process.env.NEXT_PUBLIC_LEITURA_API_URL ?? 'http://localhost:62000';
const ORDENS_API_BASE_URL =
  process.env.NEXT_PUBLIC_ORDENS_API_URL ?? 'http://localhost:62001';

const leituraApi = axios.create({
  baseURL: LEITURA_API_BASE_URL,
});

const ordensApi = axios.create({
  baseURL: ORDENS_API_BASE_URL,
});

export const api = {
  getQuotations: async () => {
    const response = await leituraApi.get('/quotations');
    return response.data;
  },

  getQuotation: async (symbol: string) => {
    const response = await leituraApi.get(`/quotations/${symbol}`);
    return response.data;
  },

  createOrder: async (orderData: {
    userId: UserId;
    symbol: string;
    type: 'COMPRA' | 'VENDA';
    quantity: number;
    price: number;
  }) => {
    const payload = {
      userId: orderData.userId,
      symbol: orderData.symbol,
      type: orderData.type,
      quantity: orderData.quantity,
      price: orderData.price,
    };

    console.groupCollapsed('[API] POST /criar-ordens');
    console.log('URL:', `${ORDENS_API_BASE_URL}/criar-ordens`);
    console.log('Payload:', payload);
    console.groupEnd();

    const response = await ordensApi.post('/criar-ordens', payload);
    return response.data;
  },

  getOrders: async (userId: UserId) => {
    const response = await leituraApi.get('/orders', {
      params: { userId },
    });
    return response.data;
  },

  getOrder: async (orderId: number) => {
    const response = await leituraApi.get(`/orders/${orderId}`);
    return response.data;
  },

  cancelOrder: async (orderId: number) => {
    const response = await ordensApi.post(`/orders/${orderId}/cancel`);
    return response.data;
  },

  getPositions: async (userId: UserId) => {
    const response = await leituraApi.get('/positions', {
      params: { userId },
    });
    return response.data;
  },
};
