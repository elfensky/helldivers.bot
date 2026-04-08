/**
 * Generates a Gravatar URL for the given email address.
 * Uses Web Crypto API (SHA-256) so it works in Node, browsers, and edge runtimes.
 * @param {string} email
 * @returns {Promise<string>} Gravatar URL with 64px size parameter
 */
export async function getGravatarUrl(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const encoded = new TextEncoder().encode(normalizedEmail);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return `https://www.gravatar.com/avatar/${hash}?s=64`;
}
