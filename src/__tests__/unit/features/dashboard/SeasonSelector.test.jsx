// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import SeasonSelector from '@/features/dashboard/SeasonSelector';

describe('SeasonSelector', () => {
    let locationHref;

    beforeEach(() => {
        locationHref = '';
        Object.defineProperty(window, 'location', {
            value: {
                href: '',
                search: '',
                get href() {
                    return locationHref;
                },
                set href(url) {
                    locationHref = url;
                },
            },
            writable: true,
            configurable: true,
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

    test('changing select navigates to correct URL', () => {
        render(<SeasonSelector seasons={[1, 2, 3]} currentSeason={1} />);
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: '3' } });
        expect(locationHref).toBe('/archives?season=3');
    });
});
