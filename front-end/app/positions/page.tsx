'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import PositionList from '@/components/PositionList';
import { useSelectedUser } from '@/lib/useSelectedUser';

export default function PositionsPage() {
  const { userId, setUserId } = useSelectedUser();
  const [refresh, setRefresh] = useState(0);

  return (
    <>
      <Navigation activeTab="positions" userId={userId} onUserChange={setUserId} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">💼 Minha Carteira</h1>
            <p className="text-gray-600">Visão consolidada do seu saldo em cada ativo</p>
          </div>
          <button
            onClick={() => setRefresh(prev => prev + 1)}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-green-600 font-semibold transition"
          >
            Atualizar
          </button>
        </div>

        <PositionList userId={userId} refresh={refresh} />
      </main>
    </>
  );
}
