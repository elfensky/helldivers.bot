export const REGIONS_VIEW_KEY = 'hd1-regions-view';
export const REGIONS_VIEW_DEFAULT = 'sector';

export function validateRegionsView(value) {
    return value === 'sector' || value === 'campaign' ?
            value
        :   REGIONS_VIEW_DEFAULT;
}
