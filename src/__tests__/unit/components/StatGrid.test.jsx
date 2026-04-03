// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/h1/StatGrid/StatGrid.css', () => ({}));

import StatGrid from '@/components/h1/StatGrid/StatGrid';

const mockLive = [
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
        players: 200,
        kills: 1000,
        deaths: 80,
        accidentals: 20,
        successful_missions: 60,
        missions: 70,
    },
    {
        enemy: 2,
        players: 150,
        kills: 750,
        deaths: 40,
        accidentals: 5,
        successful_missions: 45,
        missions: 50,
    },
];

const mockEvents = [
    { enemy: 0, status: 'success' },
    { enemy: 0, status: 'fail' },
    { enemy: 1, status: 'success' },
    { enemy: 1, status: 'success' },
    { enemy: 2, status: 'fail' },
];

describe('StatGrid', () => {
    test('returns null when live is empty', () => {
        const { container } = render(
            <StatGrid live={[]} faction="global" events={[]} />,
        );
        expect(container.innerHTML).toBe('');
    });

    test('returns null when live is undefined', () => {
        const { container } = render(<StatGrid faction="global" events={[]} />);
        expect(container.innerHTML).toBe('');
    });

    describe('global view', () => {
        test('shows formatted totals', () => {
            render(
                <StatGrid live={mockLive} faction="global" events={mockEvents} />,
            );
            expect(screen.getByText('HELLDIVERS_ONLINE')).toBeInTheDocument();
            expect(screen.getByText('ENEMIES_KILLED')).toBeInTheDocument();
            expect(screen.getByText('HELLDIVERS_LOST')).toBeInTheDocument();
            expect(screen.getByText('ACCIDENTALS')).toBeInTheDocument();
        });

        test('shows correct aggregated values', () => {
            render(
                <StatGrid live={mockLive} faction="global" events={mockEvents} />,
            );
            // players: 100+200+150 = 450
            expect(screen.getByText('450')).toBeInTheDocument();
            // kills: 500+1000+750 = 2,250
            expect(screen.getByText('2,250')).toBeInTheDocument();
            // deaths: 50+80+40 = 170
            expect(screen.getByText('170')).toBeInTheDocument();
            // accidentals: 10+20+5 = 35
            expect(screen.getByText('35')).toBeInTheDocument();
        });

        test('shows win/loss counts from all factions', () => {
            render(
                <StatGrid live={mockLive} faction="global" events={mockEvents} />,
            );
            expect(screen.getByText('WON')).toBeInTheDocument();
            expect(screen.getByText('LOST')).toBeInTheDocument();
            // wins: 3 (enemy0 success + enemy1 success + enemy1 success)
            expect(screen.getByText('3')).toBeInTheDocument();
            // losses: 2 (enemy0 fail + enemy2 fail)
            expect(screen.getByText('2')).toBeInTheDocument();
        });
    });

    describe('faction view', () => {
        test('shows faction-specific stat labels', () => {
            render(
                <StatGrid live={mockLive} faction="bugs" events={mockEvents} />,
            );
            expect(screen.getByText('ONLINE')).toBeInTheDocument();
            expect(screen.getByText('MISSIONS')).toBeInTheDocument();
            expect(screen.getByText('DEATHS')).toBeInTheDocument();
            expect(screen.getByText('ACCIDENTALS')).toBeInTheDocument();
        });

        test('shows bugs faction values', () => {
            render(
                <StatGrid live={mockLive} faction="bugs" events={mockEvents} />,
            );
            // bugs: players=100, successful_missions=30, deaths=50, accidentals=10
            expect(screen.getByText('100')).toBeInTheDocument();
            expect(screen.getByText('30')).toBeInTheDocument();
            expect(screen.getByText('50')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        test('shows faction-filtered win/loss counts', () => {
            render(
                <StatGrid live={mockLive} faction="bugs" events={mockEvents} />,
            );
            // bugs (enemy=0): 1 success, 1 fail
            expect(screen.getByText('WON')).toBeInTheDocument();
            expect(screen.getByText('LOST')).toBeInTheDocument();
            const ones = screen.getAllByText('1');
            expect(ones).toHaveLength(2); // 1 win + 1 loss
        });

        test('returns null when faction not found in live data', () => {
            const sparseData = [{ enemy: 0, players: 100, kills: 500, deaths: 50, accidentals: 10 }];
            const { container } = render(
                <StatGrid live={sparseData} faction="illuminate" events={[]} />,
            );
            expect(container.innerHTML).toBe('');
        });
    });
});
