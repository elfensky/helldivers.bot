'use client';
import { createContext, useContext } from 'react';

/** @typedef {import('@/shared/hooks/useLiveData.mjs').LiveStatus} LiveStatus */
/** @typedef {import('@/shared/hooks/useLiveData.mjs').LiveStore} LiveStore */

/** @type {import('react').Context<LiveStore | null>} */
export const LiveDataContext = createContext(/** @type {LiveStore | null} */ (null));

/**
 * Read live campaign data from the nearest LiveDataProvider.
 * Throws if called outside a provider — catches wiring bugs early.
 *
 * @returns {{data: object | null, mapState: object | null, status: LiveStatus, prevData: object | null, isLeader: boolean}}
 */
export function useLiveDataContext() {
    const ctx = useContext(LiveDataContext);
    if (ctx === null) {
        throw new Error('useLiveDataContext must be used within a LiveDataProvider');
    }
    return ctx;
}
