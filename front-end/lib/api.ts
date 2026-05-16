import axios from 'axios';

const API_BASE_URL = 'http://localhost:62000';

// Tipo para usuário
const CURRENT_USER_ID = 'user-001';

export const api = {
  // ===== QUOTATIONS =====
  getQuotations: async () => {
    const response = await axios.get(`${API_BASE_URL}/quotations`);
    return response.data;
  },

  getQuotation: async (symbol: string) => {
    const response = await axios.get(`${API_BASE_URL}/quotations/${symbol}`);
    return response.data;
  },

  // ===== ORDERS =====
  createOrder: async (orderData: {
    symbol: string;
    type: 'COMPRA' | 'VENDA';
    quantity: number;
    price: number;
  }) => {
    const response = await axios.post(`${API_BASE_URL}/orders`, {
      userId: CURRENT_USER_ID,
      ...orderData,
    });
    return response.data;
  },

  getOrders: async () => {
    const response = await axios.get(`${API_BASE_URL}/orders`, {
      params: { userId: CURRENT_USER_ID },
    });
    return response.data;
  },

  getOrder: async (orderId: number) => {
    const response = await axios.get(`${API_BASE_URL}/orders/${orderId}`);
    return response.data;
  },

  cancelOrder: async (orderId: number) => {
    const response = await axios.post(`${API_BASE_URL}/orders/${orderId}/cancel`);
    return response.data;
  },

  processOrder: async (orderId: number, currentPrice: number) => {
    const response = await axios.post(`${API_BASE_URL}/orders/${orderId}/process`, {
      currentPrice,
    });
    return response.data;
  },

  // ===== POSITIONS =====
  getPositions: async () => {
    const response = await axios.get(`${API_BASE_URL}/positions`, {
      params: { userId: CURRENT_USER_ID },
    });
    return response.data;
  },
};
