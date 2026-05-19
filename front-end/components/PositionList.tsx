'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { UserId } from '@/lib/useSelectedUser';

interface Position {
  id: number;
  symbol: string;
  quantity: number;
  average_price: number;
  asset_name: string;
  current_price: number;
  profit_loss: number;
}

interface PositionListProps {
  userId: UserId;
  refresh?: number;
}

export default function PositionList({ userId, refresh = 0 }: PositionListProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPositions(true);

    const intervalId = window.setInterval(() => {
      fetchPositions();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [refresh, userId]);

  const fetchPositions = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const data = await api.getPositions(userId);
      setPositions(data);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar posições:', err);
      setError('Erro ao carregar posições');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const formatNumber = (value: number) => value.toFixed(2);
  const formatCurrency = (value: number) => `R$ ${formatNumber(value)}`;
  const getPositionValue = (position: Position) =>
    position.quantity * position.current_price;

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <p className="text-gray-500">Carregando posições...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg shadow border border-red-200">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => fetchPositions(true)}
          className="mt-2 px-4 py-2 bg-primary text-white rounded hover:bg-green-600"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg shadow border-l-4 border-primary">
        <p className="text-gray-500">Nenhuma posição ativa</p>
      </div>
    );
  }

  const totalPortfolioValue = positions.reduce(
    (sum, position) => sum + getPositionValue(position),
    0
  );
  const totalProfitLoss = positions.reduce((sum, p) => sum + p.profit_loss, 0);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-primary text-white rounded-lg shadow">
          <p className="text-sm opacity-90">Valor Total da Carteira</p>
          <p className="text-3xl font-bold">{formatCurrency(totalPortfolioValue)}</p>
        </div>
        <div className={`p-4 rounded-lg shadow text-white ${totalProfitLoss >= 0 ? 'bg-green-600' : 'bg-red-600'}`}>
          <p className="text-sm opacity-90">Ganho/Perda Total</p>
          <p className="text-3xl font-bold">
            {totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(totalProfitLoss)}
          </p>
        </div>
        <div className="p-4 bg-blue-600 text-white rounded-lg shadow">
          <p className="text-sm opacity-90">Quantidade de Ativos</p>
          <p className="text-3xl font-bold">{positions.length}</p>
        </div>
      </div>

      {/* Positions List */}
      <div className="space-y-3">
        {positions.map((position) => (
          <div
            key={position.id}
            className="p-4 bg-white rounded-lg shadow border-l-4 border-primary hover:shadow-lg transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800">
                  {position.symbol}
                </h3>
                <p className="text-sm text-gray-600">{position.asset_name}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(getPositionValue(position))}
                </p>
                <p className={`text-sm font-semibold ${position.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {position.profit_loss >= 0 ? '+' : ''}{formatCurrency(position.profit_loss)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-600 text-xs">Quantidade</p>
                <p className="font-semibold text-gray-800">{formatNumber(position.quantity)}</p>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-600 text-xs">Preço Médio</p>
                <p className="font-semibold text-gray-800">
                  {formatCurrency(position.average_price)}
                </p>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-600 text-xs">Preço Atual</p>
                <p className="font-semibold text-gray-800">
                  {formatCurrency(position.current_price)}
                </p>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-600 text-xs">Variação</p>
                <p className={`font-semibold ${position.current_price >= position.average_price ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(((position.current_price - position.average_price) / position.average_price) * 100)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
