// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('swagger-ui-dist', () => ({ SwaggerUIBundle: vi.fn() }));
vi.mock('swagger-ui-dist/swagger-ui.css', () => ({}));
vi.mock('@/components/layout/OpenAPI/swaggerDark.css', () => ({}));

import DocsClient from '@/components/layout/OpenAPI/DocsClient';
import { SwaggerUIBundle } from 'swagger-ui-dist';

describe('DocsClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders wrapper div', () => {
        const { container } = render(<DocsClient spec={null} />);
        expect(container.querySelector('.swagger-ui-wrapper')).toBeInTheDocument();
    });

    test('calls SwaggerUIBundle with spec when provided', () => {
        const spec = { openapi: '3.0.0', info: { title: 'Test', version: '1.0' } };
        render(<DocsClient spec={spec} />);
        expect(SwaggerUIBundle).toHaveBeenCalledWith(expect.objectContaining({ spec }));
    });

    test('does not call SwaggerUIBundle when spec is null', () => {
        render(<DocsClient spec={null} />);
        expect(SwaggerUIBundle).not.toHaveBeenCalled();
    });
});
