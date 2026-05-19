'use client';

import Link from 'next/link';
import { USER_IDS, UserId } from '@/lib/useSelectedUser';

interface NavProps {
  activeTab: string;
  userId: UserId;
  onUserChange: (userId: UserId) => void;
}

export default function Navigation({ activeTab, userId, onUserChange }: NavProps) {
  return (
    <nav className="bg-primary text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">💰</span>
            Investment Orders
          </Link>

          <div className="flex gap-8">
            <Link
              href="/"
              className={`px-4 py-2 rounded font-semibold transition ${
                activeTab === 'home'
                  ? 'bg-white text-primary'
                  : 'text-white hover:bg-green-600'
              }`}
            >
              Ativos
            </Link>
            <Link
              href="/orders"
              className={`px-4 py-2 rounded font-semibold transition ${
                activeTab === 'orders'
                  ? 'bg-white text-primary'
                  : 'text-white hover:bg-green-600'
              }`}
            >
              Ordens
            </Link>
            <Link
              href="/positions"
              className={`px-4 py-2 rounded font-semibold transition ${
                activeTab === 'positions'
                  ? 'bg-white text-primary'
                  : 'text-white hover:bg-green-600'
              }`}
            >
              Carteira
            </Link>
          </div>

          <div className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded">
            <select
              value={userId}
              onChange={(event) => onUserChange(event.target.value as UserId)}
              className="bg-transparent font-semibold text-white outline-none"
              aria-label="Selecionar usuário"
            >
              {USER_IDS.map((id) => (
                <option key={id} value={id} className="text-gray-900">
                  {id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </nav>
  );
}
