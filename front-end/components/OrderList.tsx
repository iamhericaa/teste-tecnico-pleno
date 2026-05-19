'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { UserId } from '@/lib/useSelectedUser';

interface Order {
  id: number;
  symbol: string;
  type: 'COMPRA' | 'VENDA';
  quantity: number;
  price: number;
  status: 'PENDENTE' | 'PROCESSANDO' | 'EXECUTADA' | 'REJEITADA' | 'CANCELADA';
  created_at: string;
  updated_at: string;
}

interface OrderListProps {
  userId: UserId;
  refresh?: number;
}

export default function OrderList({ userId, refresh = 0 }: OrderListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [refresh, userId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getOrders(userId);
      setOrders(data);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar ordens:', err);
      setError('Erro ao carregar ordens');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: number) => {
    try {
      setCancelingId(orderId);
      await api.cancelOrder(orderId);
      fetchOrders();
    } catch (err: any) {
      console.error('Erro ao cancelar ordem:', err);
      alert(err.response?.data?.error || 'Erro ao cancelar ordem');
    } finally {
      setCancelingId(null);
    }
  };

  const handleShowDetails = async (orderId: number) => {
    try {
      setDetailsLoadingId(orderId);
      const order = await api.getOrder(orderId);
      setSelectedOrder(order);
    } catch (err: any) {
      console.error('Erro ao buscar detalhe da ordem:', err);
      alert(err.response?.data?.error || 'Erro ao buscar detalhe da ordem');
    } finally {
      setDetailsLoadingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'PROCESSANDO':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'EXECUTADA':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'REJEITADA':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'CANCELADA':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'COMPRA' ? '📈' : '📉';
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <p className="text-gray-500">Carregando ordens...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg shadow border border-red-200">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchOrders}
          className="mt-2 px-4 py-2 bg-primary text-white rounded hover:bg-green-600"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg shadow border-l-4 border-primary">
        <p className="text-gray-500">Nenhuma ordem criada ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div
          key={order.id}
          className="p-4 bg-white rounded-lg shadow border-l-4 border-primary hover:shadow-lg transition"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getTypeIcon(order.type)}</span>
                <h3 className="text-lg font-bold text-gray-800">
                  #{order.id} - {order.symbol}
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                    order.status
                  )}`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {order.type === 'COMPRA' ? 'Compra' : 'Venda'} de{' '}
                <strong>{order.quantity}</strong> unidades a{' '}
                <strong>R$ {order.price.toFixed(2)}</strong>
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-primary">
                R$ {(order.quantity * order.price).toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(order.created_at).toLocaleDateString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => handleShowDetails(order.id)}
              disabled={detailsLoadingId === order.id}
              className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 text-sm font-semibold transition"
            >
              {detailsLoadingId === order.id ? 'Carregando...' : 'Detalhes'}
            </button>

            {order.status === 'PENDENTE' && (
              <button
                onClick={() => handleCancel(order.id)}
                disabled={cancelingId === order.id}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 text-sm font-semibold transition"
              >
                {cancelingId === order.id ? 'Cancelando...' : 'Cancelar Ordem'}
              </button>
            )}
          </div>

          {selectedOrder?.id === order.id && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <span><strong>ID:</strong> {selectedOrder.id}</span>
                <span><strong>Ativo:</strong> {selectedOrder.symbol}</span>
                <span><strong>Status:</strong> {selectedOrder.status}</span>
                <span><strong>Tipo:</strong> {selectedOrder.type}</span>
                <span><strong>Quantidade:</strong> {selectedOrder.quantity}</span>
                <span><strong>Preço:</strong> R$ {selectedOrder.price.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
