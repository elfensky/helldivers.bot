import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prismaClientSingleton = () => {
    const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
    return new PrismaClient({ adapter });
};

const db = globalThis.prismaGlobal || prismaClientSingleton();

if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = db;
}

export default db;
