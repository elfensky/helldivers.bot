// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

import ServiceWorkerRegister from '@/shared/components/ServiceWorkerRegister';
import { reportError } from '@/shared/utils/observability.mjs';

vi.mock('@/shared/utils/observability.mjs', () => ({ reportError: vi.fn() }));

// #670: no page registered the worker, so push subscribe hung on
// `navigator.serviceWorker.ready` and the precache never installed.
function stubServiceWorker(register) {
    Object.defineProperty(navigator, 'serviceWorker', {
        value: { register },
        configurable: true,
    });
}

describe('ServiceWorkerRegister', () => {
    beforeEach(() => {
        vi.mocked(reportError).mockClear();
        vi.stubEnv('NODE_ENV', 'production');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete navigator.serviceWorker;
    });

    test('registers /sw.js in production', () => {
        const register = vi.fn(() => Promise.resolve({}));
        stubServiceWorker(register);
        render(<ServiceWorkerRegister />);
        expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js');
    });

    test('registers nothing outside production', () => {
        // `next dev` has no current build of public/sw.js to serve.
        vi.stubEnv('NODE_ENV', 'development');
        const register = vi.fn(() => Promise.resolve({}));
        stubServiceWorker(register);
        render(<ServiceWorkerRegister />);
        expect(register).not.toHaveBeenCalled();
    });

    test('renders nothing and does not throw without service worker support', () => {
        const { container } = render(<ServiceWorkerRegister />);
        expect(container).toBeEmptyDOMElement();
    });

    test('reports a failed registration at warning', async () => {
        const error = new TypeError('Failed to register a ServiceWorker: 404');
        stubServiceWorker(vi.fn(() => Promise.reject(error)));
        render(<ServiceWorkerRegister />);
        await vi.waitFor(() =>
            expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
                source: 'sw-register',
                level: 'warning',
            }),
        );
    });

    test('a SecurityError (site data blocked) is expected and gets no report', async () => {
        const register = vi.fn(() =>
            Promise.reject(
                new DOMException('The user denied permission', 'SecurityError'),
            ),
        );
        stubServiceWorker(register);
        render(<ServiceWorkerRegister />);
        await vi.waitFor(() => expect(register).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(reportError).not.toHaveBeenCalled();
    });
});
