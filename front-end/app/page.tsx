'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import AssetList from '@/components/AssetList';
import CreateOrderModal from '@/components/CreateOrderModal';
import { useSelectedUser } from '@/lib/useSelectedUser';

interface Asset {
  symbol: string;
  name: string;
  reference_price: number;
}

export default function Home() {
  const { userId, setUserId } = useSelectedUser();
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshOrders, setRefreshOrders] = useState(0);

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsModalOpen(true);
  };

  const handleOrderSuccess = () => {
    setRefreshOrders(prev => prev + 1);
  };

  return (
    <>
      <Navigation activeTab="home" userId={userId} onUserChange={setUserId} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">📈 Ativos Disponíveis</h1>
          <p className="text-gray-600">Clique em um ativo para criar uma ordem</p>
        </div>

        <AssetList onSelectAsset={handleSelectAsset} />

        <CreateOrderModal
          asset={selectedAsset}
          userId={userId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleOrderSuccess}
        />
      </main>
    </>
  );
}
