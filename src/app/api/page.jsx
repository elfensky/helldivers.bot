import { redirect } from 'next/navigation';

export default function ApiDocsPage() {
    redirect('/about#docs');
}
