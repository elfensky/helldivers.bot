import { z } from 'zod';
import {
    extendZodWithOpenApi,
    OpenAPIRegistry,
    OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Create registry
const registry = new OpenAPIRegistry();

// Common schemas
const ErrorResponseSchema = z
    .object({
        time: z
            .number()
            .openapi({ description: 'Time taken to process the request (ms)' }),
        code: z.number().openapi({ description: 'HTTP status code' }),
        message: z.string().openapi({ description: 'Human-readable status message' }),
        error: z.any().openapi({ description: 'Error details or null' }),
    })
    .openapi('ErrorResponse');

const SuccessResponseSchema = z
    .object({
        time: z
            .number()
            .openapi({ description: 'Time taken to process the request (ms)' }),
        code: z.number().openapi({ description: 'HTTP status code' }),
        message: z.string().openapi({ description: 'Human-readable status message' }),
        data: z.any().openapi({ description: 'Response data' }),
    })
    .openapi('SuccessResponse');

// Register common schemas
registry.register('ErrorResponse', ErrorResponseSchema);
registry.register('SuccessResponse', SuccessResponseSchema);

// /api/h1/campaign - GET
registry.registerPath({
    method: 'get',
    path: '/api/h1/campaign',
    summary: 'Get campaign data for a specific season or the latest.',
    description:
        'Returns campaign data for a given season if the `season` query parameter is provided and valid. If no season is provided, returns the latest campaign data. If data is not found locally, attempts to fetch and update from a remote source.',
    request: {
        query: z.object({
            season: z.string().optional().openapi({
                description: 'The season number to fetch campaign data for.',
                example: '1',
            }),
        }),
    },
    responses: {
        200: {
            description: 'Campaign data found and returned successfully.',
            content: {
                'application/json': {
                    schema: z.object({
                        time: z.number().openapi({
                            description: 'Time taken to process the request (ms)',
                        }),
                        code: z.number().openapi({ description: 'HTTP status code' }),
                        message: z
                            .string()
                            .openapi({ description: 'Human-readable status message' }),
                        data: z
                            .any()
                            .openapi({ description: 'The campaign data object' }),
                    }),
                },
            },
        },
        400: {
            description: 'Invalid season parameter.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        404: {
            description: 'Campaign data not found.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        500: {
            description: 'Internal server error.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
    },
});

// /api/h1/rebroadcast - POST
const RebroadcastFormDataSchema = z
    .object({
        action: z
            .enum(['get_campaign_status', 'get_snapshots'])
            .openapi({ description: 'The action to perform.' }),
        season: z
            .number()
            .int()
            .positive()
            .optional()
            .openapi({ description: 'Required if action is get_snapshots.', minimum: 1 }),
    })
    .openapi('RebroadcastFormData');

registry.registerPath({
    method: 'post',
    path: '/api/h1/rebroadcast',
    summary: 'Perform a campaign status or snapshot action',
    request: {
        body: {
            required: true,
            content: {
                'multipart/form-data': {
                    schema: RebroadcastFormDataSchema,
                },
                'application/x-www-form-urlencoded': {
                    schema: RebroadcastFormDataSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Success',
            content: {
                'application/json': {
                    schema: z.any(),
                },
            },
        },
        400: {
            description: 'Invalid request (content type, action, or arguments).',
            content: {
                'application/json': {
                    schema: z.object({
                        time: z.number(),
                        error_code: z.number(),
                        error_message: z.string(),
                    }),
                },
            },
        },
        404: {
            description: 'Not found.',
            content: {
                'application/json': {
                    schema: z.object({
                        time: z.number(),
                        error_code: z.number(),
                        error_message: z.string(),
                    }),
                },
            },
        },
        401: {
            description: 'Unauthorized. API key missing, malformed, or not found.',
            content: {
                'application/json': {
                    schema: z.object({
                        time: z.number(),
                        error_code: z.number(),
                        error_message: z.string(),
                    }),
                },
            },
        },
        403: {
            description: 'Forbidden. API key found but disabled.',
            content: {
                'application/json': {
                    schema: z.object({
                        time: z.number(),
                        error_code: z.number(),
                        error_message: z.string(),
                    }),
                },
            },
        },
        405: {
            description: 'Method not allowed.',
            content: {
                'application/json': {
                    schema: z.object({
                        time: z.number(),
                        error_code: z.number(),
                        error_message: z.string(),
                    }),
                },
            },
        },
    },
});

// /api/h1/update - GET (Internal)
registry.registerPath({
    method: 'get',
    path: '/api/h1/update',
    summary: 'Trigger current campaign status and snapshot updates',
    description:
        "**Internal-use-only.** This endpoint is used by a node (web) worker to continuously trigger status and season updates for the current campaign. It is not intended for external user consumption. Requires a valid `key` query parameter matching the server's `UPDATE_KEY` environment variable.",
    tags: ['Internal'],
    request: {
        query: z.object({
            key: z
                .string()
                .openapi({ description: 'Internal API key for authorization.' }),
        }),
    },
    responses: {
        200: {
            description: 'Update successful. Returns the updated status and season data.',
            content: {
                'application/json': {
                    schema: z.object({
                        time: z.number(),
                        code: z.number(),
                        message: z.string(),
                        data: z.object({
                            updated: z.object({
                                status: z
                                    .any()
                                    .openapi({ description: 'The updated status data.' }),
                                season: z
                                    .any()
                                    .openapi({ description: 'The updated season data.' }),
                            }),
                        }),
                    }),
                },
            },
        },
        400: {
            description: 'Bad request. Missing key parameter.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        401: {
            description: 'Unauthorized. The provided key is missing or invalid.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        405: {
            description: 'Method Not Allowed. Only GET is supported.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        500: {
            description: 'Internal server error.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
    },
});

// /api/h1/stream - GET (SSE)
registry.registerPath({
    method: 'get',
    path: '/api/h1/stream',
    summary: 'Subscribe to real-time campaign updates via Server-Sent Events',
    description:
        'Opens a persistent SSE connection that pushes `campaign_update` events whenever the campaign state changes. Connect using the browser `EventSource` API or the `useLiveData` hook.',
    responses: {
        200: {
            description:
                'SSE stream opened. Events are pushed as `event: campaign_update` with JSON data.',
            content: {
                'text/event-stream': {
                    schema: z.string().openapi({
                        description:
                            'Server-Sent Events stream. Each event: `event: campaign_update\\ndata: {…}\\n\\n`',
                    }),
                },
            },
        },
        503: {
            description: 'SSE service is unhealthy or unavailable.',
        },
    },
});

// /api/notifications/subscribe - POST
const PushSubscriptionSchema = z
    .object({
        endpoint: z
            .string()
            .url()
            .openapi({ description: 'The push subscription endpoint URL.' }),
        keys: z.object({
            p256dh: z.string().openapi({
                description: 'Base64-encoded P-256 ECDH public key.',
            }),
            auth: z.string().openapi({
                description: 'Base64-encoded authentication secret.',
            }),
        }),
    })
    .openapi('PushSubscription');

registry.registerPath({
    method: 'post',
    path: '/api/notifications/subscribe',
    summary: 'Subscribe to push notifications',
    description:
        'Registers a Web Push subscription. The server will send push notifications for campaign events (started, won, lost) to the provided endpoint.',
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: PushSubscriptionSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Subscription created or updated.',
            content: {
                'application/json': {
                    schema: SuccessResponseSchema,
                },
            },
        },
        400: {
            description: 'Invalid JSON or missing required fields.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        500: {
            description: 'Internal server error.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
    },
});

// /api/notifications/subscribe - DELETE
registry.registerPath({
    method: 'delete',
    path: '/api/notifications/subscribe',
    summary: 'Unsubscribe from push notifications',
    description:
        'Removes a Web Push subscription by endpoint URL. Silently succeeds if the subscription does not exist.',
    request: {
        body: {
            required: true,
            content: {
                'application/json': {
                    schema: z.object({
                        endpoint: z.string().url().openapi({
                            description: 'The push subscription endpoint URL to remove.',
                        }),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Subscription removed.',
            content: {
                'application/json': {
                    schema: SuccessResponseSchema,
                },
            },
        },
        400: {
            description: 'Invalid JSON or missing endpoint.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        500: {
            description: 'Internal server error.',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
    },
});

// Generate OpenAPI spec
export function generateOpenApiSpec() {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            title: 'Helldivers 1 API',
            version: '0.23.0',
            description: 'A simple API',
        },
    });
}
