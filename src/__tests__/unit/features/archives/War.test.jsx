// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: vi.fn(),
}));

import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import War, { WarOutcome } from '@/features/archives/War';

const makeLive = () => [
    {
        enemy: 0,
        players: 100,
        kills: 500,
        deaths: 50,
        accidentals: 10,
        successful_missions: 30,
        missions: 40,
    },
    {
        enemy: 1,
        players: 80,
        kills: 400,
        deaths: 40,
        accidentals: 8,
        successful_missions: 25,
        missions: 35,
    },
    {
        enemy: 2,
        players: 60,
        kills: 300,
        deaths: 30,
        accidentals: 5,
        successful_missions: 20,
        missions: 30,
    },
];

describe('War', () => {
    test('returns null when no live data', () => {
        const { container } = render(<War data={{}} />);
        expect(container.innerHTML).toBe('');
    });

    test('returns null when live is empty array', () => {
        const { container } = render(<War data={{ live: [] }} />);
        expect(container.innerHTML).toBe('');
    });

    test('renders global stats section', () => {
        render(<War data={{ live: makeLive() }} />);
        expect(screen.getByText('Global Stats')).toBeInTheDocument();
        expect(screen.getByText('War Stats')).toBeInTheDocument();
    });

    test('renders per-faction stats', () => {
        render(<War data={{ live: makeLive() }} />);
        expect(screen.getByText('Bugs')).toBeInTheDocument();
        expect(screen.getByText('Cyborgs')).toBeInTheDocument();
        expect(screen.getByText('The Illuminate')).toBeInTheDocument();
    });
});

describe('WarOutcome', () => {
    test('returns null when getWarOutcome returns null', () => {
        getWarOutcome.mockReturnValue(null);
        const { container } = render(<WarOutcome data={{}} />);
        expect(container.innerHTML).toBe('');
    });

    test('shows "Victory" when outcome is victory', () => {
        getWarOutcome.mockReturnValue({ outcome: 'victory' });
        render(<WarOutcome data={{}} />);
        expect(screen.getByText('Victory')).toBeInTheDocument();
    });

    test('shows "Defeat" when outcome is defeat', () => {
        getWarOutcome.mockReturnValue({ outcome: 'defeat' });
        render(<WarOutcome data={{}} />);
        expect(screen.getByText('Defeat')).toBeInTheDocument();
    });
});
