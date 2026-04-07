import { createHash } from 'crypto';

/**
 * Generates a Gravatar URL for the given email address.
 * @param {string} email
 * @returns {string} Gravatar URL with 64px size parameter
 */
export function getGravatarUrl(email) {
    // Normalize the email address
    const normalizedEmail = email.trim().toLowerCase();
    // Create an MD5 hash of the normalized email
    const hash = createHash('md5').update(normalizedEmail).digest('hex');
    // Construct the Gravatar URL
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=64`;

    return gravatarUrl;
}
