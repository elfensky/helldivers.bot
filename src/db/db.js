// V1
// import { PrismaClient } from '@prisma/client';

// let db;

// if (!global.prisma) {
//     db = new PrismaClient();
//     if (process.env.NODE_ENV !== 'production') {
//         global.prisma = db;
//     }
// } else {
//     db = global.prisma;
// }

// export default db;

// V2
// import { PrismaClient } from '@prisma/client';
import { PrismaClient } from '@/generated/prisma/client';

const prismaClientSingleton = () => {
    return new PrismaClient();
};

// Check if `globalThis.prismaGlobal` is already defined, otherwise create a new instance
const db = globalThis.prismaGlobal || prismaClientSingleton();

// If `prismaGlobal` is not set, assign the new instance to it
if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = db;
}

export default db;
