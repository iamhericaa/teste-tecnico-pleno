'use client';

import { useEffect, useState } from 'react';

export const USER_IDS = ['user-001', 'user-002', 'user-003'] as const;
export type UserId = (typeof USER_IDS)[number];

const STORAGE_KEY = 'selected-user-id';
const DEFAULT_USER_ID: UserId = 'user-001';

const isUserId = (value: string | null): value is UserId =>
  USER_IDS.includes(value as UserId);

export function useSelectedUser() {
  const [userId, setUserIdState] = useState<UserId>(DEFAULT_USER_ID);

  useEffect(() => {
    const storedUserId = window.localStorage.getItem(STORAGE_KEY);

    if (isUserId(storedUserId)) {
      setUserIdState(storedUserId);
    }
  }, []);

  const setUserId = (nextUserId: UserId) => {
    setUserIdState(nextUserId);
    window.localStorage.setItem(STORAGE_KEY, nextUserId);
  };

  return { userId, setUserId };
}
