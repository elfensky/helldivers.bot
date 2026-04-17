// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/features/dashboard/RegionsViewToggle.css', () => ({}));

import RegionsViewToggle from '@/features/dashboard/RegionsViewToggle';

describe('RegionsViewToggle', () => {
    test('renders one button', () => {
        render(<RegionsViewToggle value="sector" onChange={() => {}} />);
        expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    test('aria-pressed reflects current value', () => {
        const { rerender } = render(
            <RegionsViewToggle value="sector" onChange={() => {}} />,
        );
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

        rerender(<RegionsViewToggle value="campaign" onChange={() => {}} />);
        expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('has active class in campaign view', () => {
        render(<RegionsViewToggle value="campaign" onChange={() => {}} />);
        expect(screen.getByRole('button').className).toContain('regions-toggle--active');
    });

    test('clicking toggles to the opposite value', () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <RegionsViewToggle value="sector" onChange={onChange} />,
        );

        fireEvent.click(screen.getByRole('button'));
        expect(onChange).toHaveBeenLastCalledWith('campaign');

        rerender(<RegionsViewToggle value="campaign" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button'));
        expect(onChange).toHaveBeenLastCalledWith('sector');
    });

    test('aria-label describes the target state', () => {
        const { rerender } = render(
            <RegionsViewToggle value="sector" onChange={() => {}} />,
        );
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-label',
            expect.stringMatching(/campaign/i),
        );

        rerender(<RegionsViewToggle value="campaign" onChange={() => {}} />);
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-label',
            expect.stringMatching(/sector/i),
        );
    });

    test('data-umami-event reflects the target value', () => {
        const { rerender } = render(
            <RegionsViewToggle value="sector" onChange={() => {}} />,
        );
        expect(screen.getByRole('button')).toHaveAttribute(
            'data-umami-event',
            'regions-view-campaign',
        );

        rerender(<RegionsViewToggle value="campaign" onChange={() => {}} />);
        expect(screen.getByRole('button')).toHaveAttribute(
            'data-umami-event',
            'regions-view-sector',
        );
    });
});
