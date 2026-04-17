// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import FactionTabs from '@/features/dashboard/FactionTabs';

describe('FactionTabs', () => {
    test('renders 4 buttons', () => {
        render(<FactionTabs active="global" onChange={() => {}} />);
        expect(screen.getAllByRole('button')).toHaveLength(4);
    });

    test('active tab has aria-pressed=true', () => {
        render(<FactionTabs active="bugs" onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Bugs' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(screen.getByRole('button', { name: 'Global' })).toHaveAttribute(
            'aria-pressed',
            'false',
        );
    });

    test('inactive buttons have opacity-40 class, active does not', () => {
        render(<FactionTabs active="bugs" onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Bugs' }).className).not.toContain(
            'opacity-40',
        );
        expect(screen.getByRole('button', { name: 'Global' }).className).toContain(
            'opacity-40',
        );
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

    test('each button has a faction-specific data-umami-event', () => {
        render(<FactionTabs active="global" onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Global' })).toHaveAttribute(
            'data-umami-event',
            'faction-toggle-global',
        );
        expect(screen.getByRole('button', { name: 'Bugs' })).toHaveAttribute(
            'data-umami-event',
            'faction-toggle-bugs',
        );
        expect(screen.getByRole('button', { name: 'Cyborgs' })).toHaveAttribute(
            'data-umami-event',
            'faction-toggle-cyborgs',
        );
        expect(screen.getByRole('button', { name: 'Illuminate' })).toHaveAttribute(
            'data-umami-event',
            'faction-toggle-illuminate',
        );
    });

    test('each button uses its faction-colored border', () => {
        render(<FactionTabs active="global" onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Global' }).className).toContain(
            'border-primary',
        );
        expect(screen.getByRole('button', { name: 'Bugs' }).className).toContain(
            'border-faction-bugs',
        );
        expect(screen.getByRole('button', { name: 'Cyborgs' }).className).toContain(
            'border-faction-cyborgs',
        );
        expect(screen.getByRole('button', { name: 'Illuminate' }).className).toContain(
            'border-faction-illuminate',
        );
    });
});
