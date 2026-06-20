import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const getConnectionString = () => {
    if (!process.env.POSTGRES_URL) {
        throw new Error('POSTGRES_URL is not set');
    }

    return process.env.POSTGRES_URL;
};

const prismaClientSingleton = () => {
    const adapter = new PrismaPg({ connectionString: getConnectionString() });
    return new PrismaClient({ adapter });
};

const db = globalThis.prismaGlobal || prismaClientSingleton();

if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = db;
}

export default db;
