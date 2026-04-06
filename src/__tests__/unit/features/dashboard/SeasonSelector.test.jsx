// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import SeasonSelector from '@/features/dashboard/SeasonSelector';

describe('SeasonSelector', () => {
    const mockPush = vi.fn();

    beforeEach(() => {
        mockPush.mockClear();
        vi.mocked(useRouter).mockReturnValue({
            push: mockPush,
            replace: vi.fn(),
            refresh: vi.fn(),
            back: vi.fn(),
            forward: vi.fn(),
            prefetch: vi.fn(),
        });
    });

    test('returns null when seasons is undefined', () => {
        const { container } = render(<SeasonSelector currentSeason={1} />);
        expect(container.innerHTML).toBe('');
    });

    test('returns null when seasons is empty', () => {
        const { container } = render(<SeasonSelector seasons={[]} currentSeason={1} />);
        expect(container.innerHTML).toBe('');
    });

    test('renders correct number of options', () => {
        render(<SeasonSelector seasons={[1, 2, 3]} currentSeason={2} />);
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(3);
        expect(options[0]).toHaveTextContent('Season 1');
        expect(options[1]).toHaveTextContent('Season 2');
        expect(options[2]).toHaveTextContent('Season 3');
    });

    test('sets current season as selected value', () => {
        render(<SeasonSelector seasons={[1, 2, 3]} currentSeason={2} />);
        const select = screen.getByRole('combobox');
        expect(select.value).toBe('2');
    });

    test('changing select calls router.push with correct URL', () => {
        render(<SeasonSelector seasons={[1, 2, 3]} currentSeason={1} />);
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: '3' } });
        expect(mockPush).toHaveBeenCalledWith('/archives?season=3');
    });
});
