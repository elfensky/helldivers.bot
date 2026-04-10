import dynamic from 'next/dynamic';
export default dynamic(() => import('./GlitchText'), { ssr: false });
