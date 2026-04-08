// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import SchemaTable from '@/app/docs/api/SchemaTable';

describe('SchemaTable', () => {
    test('renders property names and types from a flat schema', () => {
        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'User name' },
                age: { type: 'number', description: 'User age' },
            },
            required: ['name'],
        };

        render(<SchemaTable schema={schema} schemas={{}} />);

        expect(screen.getByText('name')).toBeInTheDocument();
        expect(screen.getByText('age')).toBeInTheDocument();
        expect(screen.getByText('string')).toBeInTheDocument();
        expect(screen.getByText('number')).toBeInTheDocument();
        expect(screen.getByText('User name')).toBeInTheDocument();
    });

    test('marks required properties with "yes"', () => {
        const schema = {
            type: 'object',
            properties: {
                required_field: { type: 'string' },
                optional_field: { type: 'string' },
            },
            required: ['required_field'],
        };

        render(<SchemaTable schema={schema} schemas={{}} />);

        const yesElements = screen.getAllByText('yes');
        const noElements = screen.getAllByText('no');
        expect(yesElements).toHaveLength(1);
        expect(noElements).toHaveLength(1);
    });

    test('resolves $ref to components schemas', () => {
        const schema = {
            type: 'object',
            properties: {
                error: { $ref: '#/components/schemas/ErrorResponse' },
            },
        };
        const schemas = {
            ErrorResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                },
            },
        };

        render(<SchemaTable schema={schema} schemas={schemas} />);

        expect(screen.getByText('error')).toBeInTheDocument();
        expect(screen.getByText('ErrorResponse')).toBeInTheDocument();
    });

    test('displays enum values', () => {
        const schema = {
            type: 'object',
            properties: {
                status: {
                    enum: ['active', 'inactive'],
                    description: 'Current status',
                },
            },
        };

        render(<SchemaTable schema={schema} schemas={{}} />);

        expect(screen.getByText('"active" | "inactive"')).toBeInTheDocument();
    });

    test('returns null for schema without properties', () => {
        const { container } = render(
            <SchemaTable schema={{ type: 'any' }} schemas={{}} />,
        );
        expect(container.querySelector('table')).not.toBeInTheDocument();
    });

    test('handles nested objects recursively', () => {
        const schema = {
            type: 'object',
            properties: {
                data: {
                    type: 'object',
                    description: 'Nested data',
                    properties: {
                        nested_field: {
                            type: 'string',
                            description: 'Inside nested',
                        },
                    },
                },
            },
        };

        render(<SchemaTable schema={schema} schemas={{}} />);

        expect(screen.getByText('data')).toBeInTheDocument();
        expect(screen.getByText('nested_field')).toBeInTheDocument();
        expect(screen.getByText('Inside nested')).toBeInTheDocument();
    });
});
