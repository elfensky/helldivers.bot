// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import EndpointCard from '@/app/docs/api/EndpointCard';

const mockSchemas = {
    ErrorResponse: {
        type: 'object',
        properties: {
            code: { type: 'number', description: 'HTTP status code' },
            message: { type: 'string', description: 'Error message' },
        },
    },
};

describe('EndpointCard', () => {
    test('renders a details element with path-based id', () => {
        const { container } = render(
            <EndpointCard
                path="/api/h1/campaign"
                methods={{
                    get: { summary: 'Get campaign data', responses: {} },
                }}
                schemas={mockSchemas}
            />,
        );

        const details = container.querySelector('details#api-h1-campaign');
        expect(details).toBeInTheDocument();
    });

    test('renders method badge with correct color for GET', () => {
        render(
            <EndpointCard
                path="/api/test"
                methods={{
                    get: { summary: 'Test endpoint', responses: {} },
                }}
                schemas={{}}
            />,
        );

        const badge = screen.getByText('get');
        expect(badge).toHaveClass('text-primary');
    });

    test('renders method badge with correct color for POST', () => {
        render(
            <EndpointCard
                path="/api/test"
                methods={{
                    post: { summary: 'Create thing', responses: {} },
                }}
                schemas={{}}
            />,
        );

        const badge = screen.getByText('post');
        expect(badge).toHaveClass('text-success');
    });

    test('renders method badge with correct color for DELETE', () => {
        render(
            <EndpointCard
                path="/api/test"
                methods={{
                    delete: { summary: 'Delete thing', responses: {} },
                }}
                schemas={{}}
            />,
        );

        const badge = screen.getByText('delete');
        expect(badge).toHaveClass('text-danger');
    });

    test('renders path in monospace', () => {
        render(
            <EndpointCard
                path="/api/h1/campaign"
                methods={{
                    get: { summary: 'Test', responses: {} },
                }}
                schemas={{}}
            />,
        );

        const pathEl = screen.getByText('/api/h1/campaign');
        expect(pathEl.tagName).toBe('CODE');
        expect(pathEl).toHaveClass('font-mono');
    });

    test('renders summary text for single-method cards', () => {
        render(
            <EndpointCard
                path="/api/test"
                methods={{
                    get: {
                        summary: 'Fetch all the things',
                        responses: {},
                    },
                }}
                schemas={{}}
            />,
        );

        expect(screen.getByText(/Fetch all the things/)).toBeInTheDocument();
    });

    test('renders multi-method card with both badges', () => {
        render(
            <EndpointCard
                path="/api/notifications/subscribe"
                methods={{
                    post: {
                        summary: 'Subscribe',
                        responses: {},
                    },
                    delete: {
                        summary: 'Unsubscribe',
                        responses: {},
                    },
                }}
                schemas={{}}
            />,
        );

        // post appears twice: once in summary, once in expanded section
        const postBadges = screen.getAllByText('post');
        const deleteBadges = screen.getAllByText('delete');
        expect(postBadges.length).toBeGreaterThanOrEqual(1);
        expect(deleteBadges.length).toBeGreaterThanOrEqual(1);
    });

    test('multi-method card has sub-anchors per method', () => {
        const { container } = render(
            <EndpointCard
                path="/api/notifications/subscribe"
                methods={{
                    post: { summary: 'Subscribe', responses: {} },
                    delete: { summary: 'Unsubscribe', responses: {} },
                }}
                schemas={{}}
            />,
        );

        expect(
            container.querySelector('#post-api-notifications-subscribe'),
        ).toBeInTheDocument();
        expect(
            container.querySelector('#delete-api-notifications-subscribe'),
        ).toBeInTheDocument();
    });

    test('renders parameters table when parameters exist', () => {
        render(
            <EndpointCard
                path="/api/test"
                methods={{
                    get: {
                        summary: 'Test',
                        parameters: [
                            {
                                name: 'season',
                                in: 'query',
                                schema: { type: 'string' },
                                required: false,
                                description: 'Season number',
                            },
                        ],
                        responses: {},
                    },
                }}
                schemas={{}}
            />,
        );

        expect(screen.getByText('season')).toBeInTheDocument();
        expect(screen.getByText('query')).toBeInTheDocument();
        expect(screen.getByText('Season number')).toBeInTheDocument();
    });

    test('renders SSE description for text/event-stream responses', () => {
        render(
            <EndpointCard
                path="/api/example/stream"
                methods={{
                    get: {
                        summary: 'Example SSE stream',
                        responses: {
                            200: {
                                description: 'Stream opened',
                                content: {
                                    'text/event-stream': {
                                        schema: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                }}
                schemas={{}}
            />,
        );

        // text/event-stream appears in header table and format description
        const sseMatches = screen.getAllByText(/text\/event-stream/);
        expect(sseMatches.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('X-Accel-Buffering')).toBeInTheDocument();
    });

    test('renders response status codes with correct colors', () => {
        render(
            <EndpointCard
                path="/api/test"
                methods={{
                    get: {
                        summary: 'Test',
                        responses: {
                            200: { description: 'Success' },
                            400: { description: 'Bad request' },
                            500: { description: 'Server error' },
                        },
                    },
                }}
                schemas={{}}
            />,
        );

        const code200 = screen.getByText('200');
        const code400 = screen.getByText('400');
        const code500 = screen.getByText('500');

        expect(code200).toHaveClass('text-success');
        expect(code400).toHaveClass('text-primary');
        expect(code500).toHaveClass('text-danger');
    });
});
