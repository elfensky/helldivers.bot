// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

    test('opacity-40 class present in sector view, absent in campaign view', () => {
        const { rerender } = render(
            <RegionsViewToggle value="sector" onChange={() => {}} />,
        );
        expect(screen.getByRole('button').className).toContain('opacity-40');

        rerender(<RegionsViewToggle value="campaign" onChange={() => {}} />);
        expect(screen.getByRole('button').className).not.toContain('opacity-40');
    });

    test('uses brandkit button classes (yellow border + hover invert)', () => {
        render(<RegionsViewToggle value="sector" onChange={() => {}} />);
        const cls = screen.getByRole('button').className;
        expect(cls).toContain('border-primary');
        expect(cls).toContain('text-primary');
        expect(cls).toContain('hover:bg-primary');
        expect(cls).toContain('hover:text-surface-0');
        // Responsive touch target: 40×40 mobile, 30×30 from md: breakpoint.
        expect(cls).toContain('size-[40px]');
        expect(cls).toContain('md:size-[30px]');
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
            expect.stringMatching(/faction/i),
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
