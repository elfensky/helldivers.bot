// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/headers', () => ({
    headers: vi.fn(() =>
        Promise.resolve({
            get: (key) => (key === 'x-nonce' ? 'test-nonce' : null),
        }),
    ),
}));
vi.mock('@/components/layout/Navigation/Navigation', () => ({
    default: () => <nav data-testid="navigation" />,
}));
vi.mock('next/script', () => ({ default: () => null }));
vi.mock('next/link', () => ({
    default: ({ children, ...props }) => <a {...props}>{children}</a>,
}));

import Header from '@/components/layout/Header/Header';

describe('Header', () => {
    test('renders header element', async () => {
        const { container } = render(await Header());
        expect(container.querySelector('header')).toBeInTheDocument();
    });

    test('renders "Helldivers Bot" text', async () => {
        render(await Header());
        expect(screen.getByText('Helldivers Bot')).toBeInTheDocument();
    });

    test('renders logo image', async () => {
        render(await Header());
        const img = screen.getByAltText(
            'Logo of Helldivers Bot, which is a cartoon depiction of a spy satellite',
        );
        expect(img).toBeInTheDocument();
    });

    test('renders Navigation component', async () => {
        render(await Header());
        expect(screen.getByTestId('navigation')).toBeInTheDocument();
    });
});
