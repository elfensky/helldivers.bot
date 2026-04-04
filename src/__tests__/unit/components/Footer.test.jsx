// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/layout/Footer/Footer.css', () => ({}));
vi.mock('next/link', () => ({
    default: ({ children, ...props }) => <a {...props}>{children}</a>,
}));

import Footer from '@/components/layout/Footer/Footer';

describe('Footer', () => {
    test('renders "Ministry of Truth" text', () => {
        render(<Footer />);
        const elements = screen.getAllByText('Ministry of Truth');
        expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    test('renders current year in copyright', () => {
        render(<Footer />);
        const year = new Date().getFullYear().toString();
        expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument();
    });

    test('renders "Andrei Lavrenov" link', () => {
        render(<Footer />);
        const link = screen.getByText('Andrei Lavrenov');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', 'https://lavrenov.io');
    });

    test('renders feature links', () => {
        render(<Footer />);
        expect(screen.getByText('Campaign')).toBeInTheDocument();
        expect(screen.getByText('Archives')).toBeInTheDocument();
        expect(screen.getByText('Docs')).toBeInTheDocument();
    });

    test('renders social links', () => {
        render(<Footer />);
        expect(screen.getByText('Helldivers Discord')).toBeInTheDocument();
        expect(screen.getByText('Github')).toBeInTheDocument();
        expect(screen.getByText('Twitter')).toBeInTheDocument();
    });

    test('renders legal section labels', () => {
        render(<Footer />);
        expect(screen.getByText('Legal')).toBeInTheDocument();
        expect(screen.getByText('Terms of Use')).toBeInTheDocument();
        expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
        expect(screen.getByText('Cookies')).toBeInTheDocument();
    });
});
