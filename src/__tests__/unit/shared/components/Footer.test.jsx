// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/shared/components/Footer/Footer.css', () => ({}));

import Footer from '@/shared/components/Footer/Footer';

describe('Footer', () => {
    test('renders "Ministry of Truth" text', () => {
        render(<Footer />);
        expect(screen.getByText('Ministry of Truth')).toBeInTheDocument();
        expect(screen.getByText('Humblebee UAV Drone Mk. IV')).toBeInTheDocument();
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
        expect(link.closest('a')).toHaveAttribute('href', 'https://lav.ren');
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

    test('renders legal links pointing to /legal', () => {
        render(<Footer />);
        expect(screen.getByText('Legal')).toBeInTheDocument();

        const terms = screen.getByText('Terms of Use');
        expect(terms.closest('a')).toHaveAttribute('href', '/legal#terms');

        const privacy = screen.getByText('Privacy Policy');
        expect(privacy.closest('a')).toHaveAttribute('href', '/legal#privacy');

        const cookies = screen.getByText('Cookies');
        expect(cookies.closest('a')).toHaveAttribute('href', '/legal#cookies');
    });
});
