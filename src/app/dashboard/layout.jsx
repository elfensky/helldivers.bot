import { auth } from '@/auth';
import { redirect } from 'next/navigation';
// import { revalidatePath } from 'next/cache';

export default async function DashboardLayout({ children }) {
    const session = await auth();
    // const headerList = await headers();
    // console.log(headerList);

    if (!session || !session.user) {
        const currentPath = '/dashboard';
        redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(currentPath)}`);
    }

    return <main>{children}</main>;
}
