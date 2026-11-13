// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/shared/components/AnalyticsOptOut', () => ({
    default: () => <p>opt-out control</p>,
}));
vi.mock('@/features/consent/ReplayChoice', () => ({
    default: () => <p>replay control</p>,
}));

import PrivacyPage from '@/app/privacy/page';

describe('/privacy', () => {
    test.each([
        'Who is responsible',
        'What is measured without asking you',
        'What happens only if you agree',
        'Your account',
        'Error tracking and abuse protection',
        "Your browser's privacy signals",
        'What we do not do',
        'Server logs',
        'Who else sees it',
        'How long it is kept',
        'Your rights',
        'Your choices',
    ])('has the section "%s"', (title) => {
        render(<PrivacyPage />);
        expect(
            screen.getByRole('heading', { level: 2, name: title }),
        ).toBeInTheDocument();
    });

    test('names the controller and privacy@lav.ren as the only contact', () => {
        const { container } = render(<PrivacyPage />);
        expect(container).toHaveTextContent('Andrei Lavrenov, a private person');
        const mailto = [...container.querySelectorAll('a[href^="mailto:"]')];
        expect(mailto.length).toBeGreaterThan(0);
        for (const a of mailto)
            expect(a).toHaveAttribute('href', 'mailto:privacy@lav.ren');
    });

    test('states the one-month answer and the Belgian authority', () => {
        const { container } = render(<PrivacyPage />);
        expect(container).toHaveTextContent('within one month (GDPR Art. 12(3))');
        expect(container).toHaveTextContent('Gegevensbeschermingsautoriteit');
    });

    test('describes the prompt, the signup box and the profile switch', () => {
        const { container } = render(<PrivacyPage />);
        expect(container).toHaveTextContent('Allow recording');
        expect(container).toHaveTextContent(
            'The Ministry of Truth wants to know who you are',
        );
        expect(container).toHaveTextContent('Link my use of this site to my account');
    });

    test('renders both browser controls', () => {
        render(<PrivacyPage />);
        expect(screen.getByText('opt-out control')).toBeInTheDocument();
        expect(screen.getByText('replay control')).toBeInTheDocument();
    });

    test('every interactive element carries an Umami event', () => {
        const { container } = render(<PrivacyPage />);
        for (const a of container.querySelectorAll('a')) {
            expect(a).toHaveAttribute('data-umami-event');
        }
    });
});
