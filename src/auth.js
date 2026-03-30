import NextAuth from 'next-auth';
//db
import { PrismaAdapter } from '@auth/prisma-adapter';
import db from '@/db/db';
//providers
import Discord from 'next-auth/providers/discord'; //discord oauth
import GitHub from 'next-auth/providers/github'; //github oauth
// import Nodemailer from 'next-auth/providers/nodemailer'; //magic links
// import Google from 'next-auth/providers/google';
// import Apple from 'next-auth/providers/apple';

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET,
    adapter: PrismaAdapter(db),
    session: {
        strategy: 'database',
    },
    providers: [
        Discord,
        GitHub,
        // Nodemailer({
        //     server: {
        //         host: process.env.EMAIL_SERVER_HOST,
        //         port: process.env.EMAIL_SERVER_PORT,
        //         auth: {
        //             user: process.env.EMAIL_SERVER_USER,
        //             pass: process.env.EMAIL_SERVER_PASSWORD,
        //         },
        //     },
        //     from: process.env.EMAIL_FROM,
        // }),
    ],
});
