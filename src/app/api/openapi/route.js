import swaggerJSDoc from 'swagger-jsdoc';
import { NextResponse } from 'next/server';

import { glob } from 'glob';

export async function GET(request) {
    const apisPattern = './src/app/api/h1/**/*.js';
    // const files = await glob(apisPattern);
    // console.log('Swagger will parse these files:', files);

    const swaggerOptions = {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'Helldivers 1 API',
                version: '0.4.1',
                description: 'A simple API',
            },
        },
        apis: [apisPattern],
    };

    const swaggerSpec = swaggerJSDoc(swaggerOptions);

    return NextResponse.json(swaggerSpec);
}
