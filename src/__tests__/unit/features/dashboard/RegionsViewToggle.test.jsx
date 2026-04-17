// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/features/dashboard/RegionsViewToggle.css', () => ({}));

import RegionsViewToggle from '@/features/dashboard/RegionsViewToggle';

describe('RegionsViewToggle', () => {
    test('renders two buttons', () => {
        render(<RegionsViewToggle value="sector" onChange={() => {}} />);
        expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    test('active button has "active" class and aria-selected=true', () => {
        render(<RegionsViewToggle value="campaign" onChange={() => {}} />);
        const campaign = screen.getByRole('tab', { name: 'Campaign' });
        const sector = screen.getByRole('tab', { name: 'Sector' });
        expect(campaign.className).toContain('active');
        expect(campaign).toHaveAttribute('aria-selected', 'true');
        expect(sector.className).not.toContain('active');
        expect(sector).toHaveAttribute('aria-selected', 'false');
    });

    test('clicking a button calls onChange with its value', () => {
        const onChange = vi.fn();
        render(<RegionsViewToggle value="sector" onChange={onChange} />);

        fireEvent.click(screen.getByRole('tab', { name: 'Campaign' }));
        expect(onChange).toHaveBeenCalledWith('campaign');

        fireEvent.click(screen.getByRole('tab', { name: 'Sector' }));
        expect(onChange).toHaveBeenCalledWith('sector');
    });

    test('each button has a data-umami-event attribute', () => {
        render(<RegionsViewToggle value="sector" onChange={() => {}} />);
        expect(screen.getByRole('tab', { name: 'Sector' })).toHaveAttribute(
            'data-umami-event',
            'regions-view-sector',
        );
        expect(screen.getByRole('tab', { name: 'Campaign' })).toHaveAttribute(
            'data-umami-event',
            'regions-view-campaign',
        );
    });
});
