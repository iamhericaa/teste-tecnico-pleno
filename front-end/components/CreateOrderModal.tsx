'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { UserId } from '@/lib/useSelectedUser';

interface Asset {
  symbol: string;
  name: string;
  reference_price: number;
}

interface CreateOrderModalProps {
  asset: Asset | null;
  userId: UserId;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateOrderModal({
  asset,
  userId,
  isOpen,
  onClose,
  onSuccess,
}: CreateOrderModalProps) {
  const [type, setType] = useState<'COMPRA' | 'VENDA'>('COMPRA');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(asset?.reference_price || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setPrice(asset.reference_price);
    }
  }, [asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantity <= 0) {
      setError('Quantidade deve ser maior que 0');
      return;
    }

    if (price <= 0) {
      setError('Preço deve ser maior que 0');
      return;
    }

    try {
      setLoading(true);
      await api.createOrder({
        userId,
        symbol: asset.symbol.trim().toUpperCase(),
        type,
        quantity: Number(quantity),
        price: Number(price),
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Erro ao criar ordem:', err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Erro ao criar ordem'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setType('COMPRA');
    setQuantity(1);
    setPrice(asset.reference_price);
    setError(null);
    onClose();
  };

  const totalValue = quantity * price;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="bg-primary text-white p-6 rounded-t-lg">
          <h2 className="text-2xl font-bold">Nova Ordem</h2>
          <p className="text-green-50">{asset.symbol} - {asset.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Ordem
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="COMPRA"
                  checked={type === 'COMPRA'}
                  onChange={(e) => setType(e.target.value as 'COMPRA' | 'VENDA')}
                  className="mr-2"
                />
                <span className="text-green-600 font-semibold">Compra</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="VENDA"
                  checked={type === 'VENDA'}
                  onChange={(e) => setType(e.target.value as 'COMPRA' | 'VENDA')}
                  className="mr-2"
                />
                <span className="text-red-600 font-semibold">Venda</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quantidade
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Preço (R$)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">Total:</div>
            <div className="text-2xl font-bold text-primary">
              R$ {totalValue.toFixed(2)}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-600 font-semibold disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? 'Criando...' : 'Criar Ordem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
