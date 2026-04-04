import { formDataToObject } from '@/shared/utils/formdata.mjs';

describe('formDataToObject', () => {
    test('returns empty object for empty FormData', () => {
        const fd = new FormData();
        expect(formDataToObject(fd)).toEqual({});
    });

    test('converts a single entry', () => {
        const fd = new FormData();
        fd.append('name', 'Super Earth');
        expect(formDataToObject(fd)).toEqual({ name: 'Super Earth' });
    });

    test('converts multiple entries', () => {
        const fd = new FormData();
        fd.append('faction', 'Bugs');
        fd.append('region', '3');
        fd.append('status', 'active');
        expect(formDataToObject(fd)).toEqual({
            faction: 'Bugs',
            region: '3',
            status: 'active',
        });
    });
});
