'use client';
//react
import { useEffect, useRef } from 'react';
//swagger
import { SwaggerUIBundle } from 'swagger-ui-dist';
import 'swagger-ui-dist/swagger-ui.css';
import './swaggerDark.css'; // see: https://github.com/Amoenus/SwaggerDark/
// Optionally, you can import SwaggerUIBundle from swagger-ui-dist
// import SwaggerUIBundle from 'swagger-ui-dist/swagger-ui-bundle.js';

export default function DocsClient({ spec }) {
    const swaggerRef = useRef(null);

    useEffect(() => {
        if (!swaggerRef.current || !spec) return;
        SwaggerUIBundle({
            domNode: swaggerRef.current,
            spec,
        });
    }, [spec]);

    return <div className="swagger-ui-wrapper" ref={swaggerRef} />;
}
