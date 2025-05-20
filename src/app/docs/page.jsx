import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function HomePage() {
    const specFile = '/api/openapi';
    return (
        <div className="bg-amber-100">
            <SwaggerUI url={specFile} />
        </div>
    );
}
