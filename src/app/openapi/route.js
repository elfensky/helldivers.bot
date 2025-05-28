import openapi from './openapi.json';

export async function GET(request) {
    return Response.json(openapi);
}
