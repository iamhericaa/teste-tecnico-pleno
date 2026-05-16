'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import OrderList from '@/components/OrderList';

export default function OrdersPage() {
  const [refresh, setRefresh] = useState(0);

  return (
    <>
      <Navigation activeTab="orders" />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">📋 Minhas Ordens</h1>
            <p className="text-gray-600">Histórico e status de todas as suas ordens</p>
          </div>
          <button
            onClick={() => setRefresh(prev => prev + 1)}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-green-600 font-semibold transition"
          >
            🔄 Atualizar
          </button>
        </div>

        <OrderList refresh={refresh} />
      </main>
    </>
  );
}
