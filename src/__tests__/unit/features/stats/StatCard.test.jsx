// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/features/stats/StatGrid';

describe('StatCard', () => {
    it('renders label and value', () => {
        render(<StatCard label="KILLS" value="2.4B" />);
        expect(screen.getByText('KILLS')).toBeDefined();
        expect(screen.getByText('2.4B')).toBeDefined();
    });

    it('applies accent color class', () => {
        const { container } = render(
            <StatCard label="WON" value="18" accentColor="success" />,
        );
        expect(container.querySelector('.stat-card-accent-success')).toBeDefined();
    });

    it('uses default accent when no color specified', () => {
        const { container } = render(<StatCard label="KILLS" value="2.4B" />);
        expect(container.querySelector('.stat-card-accent')).toBeDefined();
    });
});
