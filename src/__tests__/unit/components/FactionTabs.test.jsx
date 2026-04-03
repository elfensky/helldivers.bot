// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/h1/FactionTabs/FactionTabs.css', () => ({}));

import FactionTabs from '@/components/h1/FactionTabs/FactionTabs';

describe('FactionTabs', () => {
    test('renders 4 buttons', () => {
        render(<FactionTabs active="global" onChange={() => {}} />);
        expect(screen.getAllByRole('button')).toHaveLength(4);
    });

    test('active tab has "active" class', () => {
        render(<FactionTabs active="bugs" onChange={() => {}} />);
        const bugsButton = screen.getByRole('button', { name: 'Bugs' });
        expect(bugsButton.className).toContain('active');

        const globalButton = screen.getByRole('button', { name: 'Global' });
        expect(globalButton.className).not.toContain('active');
    });

    test('clicking a tab calls onChange with correct id', () => {
        const onChange = vi.fn();
        render(<FactionTabs active="global" onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cyborgs' }));
        expect(onChange).toHaveBeenCalledWith('cyborgs');

        fireEvent.click(screen.getByRole('button', { name: 'Illuminate' }));
        expect(onChange).toHaveBeenCalledWith('illuminate');
    });

    test('each button has an aria-label', () => {
        render(<FactionTabs active="global" onChange={() => {}} />);
        const buttons = screen.getAllByRole('button');
        for (const button of buttons) {
            expect(button).toHaveAttribute('aria-label');
        }
    });

    test('renders correct labels', () => {
        render(<FactionTabs active="global" onChange={() => {}} />);
        expect(screen.getByText('Global')).toBeInTheDocument();
        expect(screen.getByText('Bugs')).toBeInTheDocument();
        expect(screen.getByText('Cyborgs')).toBeInTheDocument();
        expect(screen.getByText('Illuminate')).toBeInTheDocument();
    });
});
