'use client';
import { createContext, useContext } from 'react';

export const LiveDataContext = createContext(null);

/**
 * Read live campaign data from the nearest LiveDataProvider.
 * Throws if called outside a provider — catches wiring bugs early.
 *
 * @returns {{data: object | null, mapState: object | null, status: string, prevData: object | null, isLeader: boolean}}
 */
export function useLiveDataContext() {
    const ctx = useContext(LiveDataContext);
    if (ctx === null) {
        throw new Error('useLiveDataContext must be used within a LiveDataProvider');
    }
    return ctx;
}
