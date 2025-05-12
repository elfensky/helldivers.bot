import NextAuth from 'next-auth';
//db
import { PrismaAdapter } from '@auth/prisma-adapter';
import db from '@/db/db';
//providers
import Discord from 'next-auth/providers/discord';
import GitHub from 'next-auth/providers/github';
// import Google from 'next-auth/providers/google';
// import Apple from 'next-auth/providers/apple';

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET,
    adapter: PrismaAdapter(db),
    session: {
        strategy: 'database',
    },
    providers: [Discord, GitHub],
});
