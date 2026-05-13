// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// UserSection has 4 distinct render branches gated on (status, isPending,
// session, avatarUrl): offline → null; pending → skeleton; logged-out → SignIn;
// logged-in-no-avatar → skeleton; logged-in-with-avatar → avatar + SignOut.
// Plus two side-effect useEffects: gravatar fetch, umami identify.

// auth-client.useSession is mocked by vitest.setup.mjs; we re-mock it here
// per-test via vi.mocked() to drive the different session states.

vi.mock('@/shared/utils/gravatar', () => ({
    getGravatarUrl: vi.fn(() => Promise.resolve('https://gravatar/avatar-hash')),
}));
// LiveDataContext is mocked globally; override per-test to drive `status`.

import { useSession } from '@/auth-client';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import { getGravatarUrl } from '@/shared/utils/gravatar';
import UserSection from '@/shared/components/Navigation/UserSection';

const baseSession = {
    user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        image: null,
    },
};

beforeEach(() => {
    vi.mocked(useLiveDataContext).mockReturnValue({ status: 'live' });
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false });
    // mockReset() clears BOTH call history AND any per-test implementation
    // overrides, so the next test starts with the default resolving mock
    // from vi.mock() at the top of the file.
    vi.mocked(getGravatarUrl)
        .mockReset()
        .mockResolvedValue('https://gravatar/avatar-hash');
    delete window.umami;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('UserSection — render gates', () => {
    test('renders null when status is offline (the live-data layer hides auth UI)', async () => {
        vi.mocked(useLiveDataContext).mockReturnValue({ status: 'offline' });
        vi.mocked(useSession).mockReturnValue({ data: baseSession, isPending: false });

        const { container } = render(<UserSection />);

        expect(container.firstChild).toBeNull();
        await act(async () => {});
    });

    test('renders skeleton while session is pending', () => {
        vi.mocked(useSession).mockReturnValue({ data: null, isPending: true });

        const { container } = render(<UserSection />);

        expect(container.querySelector('.user-section-skeleton')).toBeInTheDocument();
        expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });

    test('renders SignIn link when no session (logged out)', () => {
        vi.mocked(useSession).mockReturnValue({ data: null, isPending: false });

        render(<UserSection />);

        const signIn = screen.getByText('Sign In');
        expect(signIn.tagName).toBe('A');
        expect(signIn.getAttribute('href')).toBe('/sign-in');
        expect(signIn.getAttribute('data-umami-event')).toBe('auth-signin');
    });

    test('SignIn gets active class when pathname is /sign-in', async () => {
        const { usePathname } = await import('next/navigation');
        vi.mocked(usePathname).mockReturnValue('/sign-in');
        vi.mocked(useSession).mockReturnValue({ data: null, isPending: false });

        render(<UserSection />);

        const signIn = screen.getByText('Sign In');
        expect(signIn.className).toContain('header-nav-link--active');
    });

    test('renders skeleton when logged in but avatar URL has not resolved yet', () => {
        // Gravatar fetch never resolves — exposes the in-flight state.
        vi.mocked(getGravatarUrl).mockImplementation(() => new Promise(() => {}));
        vi.mocked(useSession).mockReturnValue({ data: baseSession, isPending: false });

        const { container } = render(<UserSection />);

        expect(container.querySelector('.user-section-skeleton')).toBeInTheDocument();
    });

    test('renders avatar + SignOut when session is loaded and avatarUrl is set', async () => {
        vi.mocked(useSession).mockReturnValue({ data: baseSession, isPending: false });

        render(<UserSection />);

        await waitFor(() => {
            // Avatar Image rendered (next/image is stubbed to <img>)
            const img = screen.getByAltText(`${baseSession.user.name} avatar`);
            expect(img.getAttribute('src')).toBe('https://gravatar/avatar-hash');
        });

        const profile = screen.getByRole('link', { name: /avatar/i });
        expect(profile.getAttribute('href')).toBe('/profile');
        expect(profile.getAttribute('data-umami-event')).toBe('nav-profile');

        expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
});

describe('UserSection — avatar URL resolution', () => {
    test('uses session.user.image when present (no gravatar fetch)', async () => {
        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    ...baseSession.user,
                    image: 'https://cdn.discordapp.com/avatars/123.png',
                },
            },
            isPending: false,
        });

        render(<UserSection />);

        await waitFor(() => {
            const img = screen.getByAltText(/Test User avatar/);
            expect(img.getAttribute('src')).toBe(
                'https://cdn.discordapp.com/avatars/123.png',
            );
        });
        expect(getGravatarUrl).not.toHaveBeenCalled();
    });

    test('falls back to gravatar for the email when session.user.image is null', async () => {
        vi.mocked(useSession).mockReturnValue({ data: baseSession, isPending: false });

        render(<UserSection />);

        await waitFor(() => {
            expect(getGravatarUrl).toHaveBeenCalledWith('test@example.com');
        });
        await waitFor(() => {
            const img = screen.getByAltText(/Test User avatar/);
            expect(img.getAttribute('src')).toBe('https://gravatar/avatar-hash');
        });
    });

    test('avatar gets the active-route ring class when pathname starts with /profile', async () => {
        const { usePathname } = await import('next/navigation');
        vi.mocked(usePathname).mockReturnValue('/profile');
        vi.mocked(useSession).mockReturnValue({
            data: { user: { ...baseSession.user, image: 'https://x/y.png' } },
            isPending: false,
        });

        render(<UserSection />);

        await waitFor(() => {
            const img = screen.getByAltText(/Test User avatar/);
            expect(img.className).toContain('ring-2');
            expect(img.className).toContain('ring-primary');
        });
    });

    test('avatar does NOT get the active-route ring class on other pages', async () => {
        const { usePathname } = await import('next/navigation');
        vi.mocked(usePathname).mockReturnValue('/');
        vi.mocked(useSession).mockReturnValue({
            data: { user: { ...baseSession.user, image: 'https://x/y.png' } },
            isPending: false,
        });

        render(<UserSection />);

        await waitFor(() => {
            const img = screen.getByAltText(/Test User avatar/);
            expect(img.className).not.toContain('ring-2');
        });
    });

    test('uses fallback "User" alt when session.user.name is missing', async () => {
        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    ...baseSession.user,
                    name: undefined,
                    image: 'https://x/y.png',
                },
            },
            isPending: false,
        });

        render(<UserSection />);

        await waitFor(() => {
            expect(screen.getByAltText('User avatar')).toBeInTheDocument();
        });
    });
});

describe('UserSection — umami identify side effect', () => {
    test('calls window.umami.identify with id + provider when umami is loaded', async () => {
        const identify = vi.fn();
        window.umami = { identify, track: vi.fn() };

        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    ...baseSession.user,
                    image: 'https://cdn.discordapp.com/avatars/abc.png',
                },
            },
            isPending: false,
        });

        render(<UserSection />);

        await waitFor(() => {
            expect(identify).toHaveBeenCalledTimes(1);
            expect(identify).toHaveBeenCalledWith('user-123', { provider: 'discord' });
        });
    });

    test('detects "github" provider from image URL', async () => {
        const identify = vi.fn();
        window.umami = { identify, track: vi.fn() };

        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    ...baseSession.user,
                    image: 'https://avatars.githubusercontent.com/u/1234',
                },
            },
            isPending: false,
        });

        render(<UserSection />);

        await waitFor(() => {
            expect(identify).toHaveBeenCalledWith('user-123', { provider: 'github' });
        });
    });

    test('reports "unknown" provider when image URL is from neither discord nor github', async () => {
        const identify = vi.fn();
        window.umami = { identify, track: vi.fn() };

        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    ...baseSession.user,
                    image: 'https://lh3.googleusercontent.com/abc',
                },
            },
            isPending: false,
        });

        render(<UserSection />);

        await waitFor(() => {
            expect(identify).toHaveBeenCalledWith('user-123', { provider: 'unknown' });
        });
    });

    test('identify is called at most once per session (identifiedRef guards re-render)', async () => {
        const identify = vi.fn();
        window.umami = { identify, track: vi.fn() };

        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    ...baseSession.user,
                    image: 'https://cdn.discordapp.com/avatars/abc.png',
                },
            },
            isPending: false,
        });

        const { rerender } = render(<UserSection />);
        await waitFor(() => expect(identify).toHaveBeenCalledTimes(1));

        rerender(<UserSection />);
        rerender(<UserSection />);

        expect(identify).toHaveBeenCalledTimes(1);
    });

    test('does NOT call identify when window.umami is absent', async () => {
        // No window.umami assigned.
        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    ...baseSession.user,
                    image: 'https://x/y.png',
                },
            },
            isPending: false,
        });

        render(<UserSection />);

        await waitFor(() => {
            expect(screen.getByText('Sign Out')).toBeInTheDocument();
        });
        // No throw, no identify call.
        expect(window.umami).toBeUndefined();
    });
});
