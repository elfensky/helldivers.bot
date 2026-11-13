// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';

import LegalPage from '@/app/legal/page';

describe('/legal', () => {
    test('#privacy points to /privacy', () => {
        const { container } = render(<LegalPage />);
        const section = container.querySelector('#privacy');
        expect(section).not.toBeNull();
        expect(section.querySelector('a[href="/privacy"]')).not.toBeNull();
    });

    test('lists the recording answer in the storage inventory', () => {
        const { container } = render(<LegalPage />);
        expect(container.querySelector('#cookies')).toHaveTextContent(
            'hd1.replay-consent',
        );
    });
});
