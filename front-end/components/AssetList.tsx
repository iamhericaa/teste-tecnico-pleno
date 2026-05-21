'use client';

import { useEffect, useState } from 'react';
import { api, type Asset, type Pagination } from '@/lib/api';

interface AssetListProps {
  onSelectAsset: (asset: Asset) => void;
}

const ASSETS_PER_PAGE = 9;

export default function AssetList({ onSelectAsset }: AssetListProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    per_page: ASSETS_PER_PAGE,
    total: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets(pagination.page, true);

    const intervalId = window.setInterval(() => {
      fetchAssets(pagination.page);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [pagination.page]);

  const fetchAssets = async (page = pagination.page, showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const result = await api.getQuotations({
        page,
        per_page: ASSETS_PER_PAGE,
      });

      setAssets(result.data);
      setPagination(result.pagination);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar ativos:', err);
      setError('Erro ao carregar ativos');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > pagination.total_pages) {
      return;
    }

    fetchAssets(page, true);
  };

  const handleSelectAsset = async (symbol: string) => {
    try {
      setLoadingSymbol(symbol);
      const asset = await api.getQuotation(symbol);
      onSelectAsset(asset);
    } catch (err) {
      console.error('Erro ao buscar ativo:', err);
      setError('Erro ao carregar ativo selecionado');
    } finally {
      setLoadingSymbol(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <p className="text-gray-500">Carregando ativos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg shadow border border-red-200">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => fetchAssets(pagination.page, true)}
          className="mt-2 px-4 py-2 bg-primary text-white rounded hover:bg-green-600"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.symbol}
            className="p-4 bg-white rounded-lg shadow border-l-4 border-primary hover:shadow-lg transition cursor-pointer"
            onClick={() => handleSelectAsset(asset.symbol)}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{asset.symbol}</h3>
                <p className="text-sm text-gray-600">{asset.name}</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-primary">
              R$ {asset.reference_price.toFixed(2)}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSelectAsset(asset.symbol);
              }}
              className="mt-3 w-full px-4 py-2 bg-primary text-white rounded hover:bg-green-600 transition font-semibold"
              disabled={loadingSymbol === asset.symbol}
            >
              {loadingSymbol === asset.symbol ? 'Carregando...' : 'Criar Ordem'}
            </button>
          </div>
        ))}
      </div>

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>

          <span className="text-sm text-gray-600">
            Pagina {pagination.page} de {pagination.total_pages} ({pagination.total} ativos)
          </span>

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.total_pages || loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proxima
          </button>
        </div>
      )}
    </div>
  );
}
