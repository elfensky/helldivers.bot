'use client';

import { useCallback } from 'react';

export function useTrack() {
    return useCallback((eventName, data) => {
        if (typeof window !== 'undefined' && window.umami) {
            window.umami.track(eventName, data);
        }
    }, []);
}
