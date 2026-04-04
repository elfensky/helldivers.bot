// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';

import Wings from '@/shared/components/Wings/Wings';

describe('Wings', () => {
    test('renders with default h2 element', () => {
        render(<Wings>Section Title</Wings>);
        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading).toBeDefined();
        expect(heading.textContent).toBe('Section Title');
    });

    test('renders with custom as="h3"', () => {
        render(<Wings as="h3">Sub Title</Wings>);
        const heading = screen.getByRole('heading', { level: 3 });
        expect(heading).toBeDefined();
        expect(heading.textContent).toBe('Sub Title');
    });

    test('renders children content', () => {
        render(
            <Wings>
                <span data-testid="child">inner</span>
            </Wings>,
        );
        const child = screen.getByTestId('child');
        expect(child).toBeDefined();
        expect(child.textContent).toBe('inner');
    });
});
