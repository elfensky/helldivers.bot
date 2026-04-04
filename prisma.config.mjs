import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
dotenv.config(); // fallback to .env (production/Docker)
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: env('POSTGRES_URL'),
    },
});
