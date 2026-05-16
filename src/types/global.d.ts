declare global {
    interface Window {
        umami?: {
            track: (
                event: string | ((props: Record<string, unknown>) => Record<string, unknown>),
                data?: Record<string, unknown>,
            ) => void;
            identify: (
                id: string | Record<string, unknown>,
                data?: Record<string, unknown>,
            ) => void;
        };
    }
}

export {};
