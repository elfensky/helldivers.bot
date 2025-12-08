## 0.8.0

- Completely rework the website layout and structure
    - Add Active component
    - Update Navigation with Github links and umami event tracking
    - Update HomePage to say more about the project (actual landing page)
        - Features
        - About
        - Roadmap
    - Update Footer to have a proper sitemap, legal and donate links.
    - Move the detailed map a new /campaign page
    - Move stats to the /stats page

- Add Mobile Navigation
- Add JSON LD to Event component
- Add robots.txt
- Add sitemap.js to generate sitemap.xml
- Update Umami tracking to only run in production.
- Remove NodeMailer and email/password login from auth.

### Docker

- `docker pull ghcr.io/elfensky/helldivers1api:0.7.4`
- `docker pull ghcr.io/elfensky/helldivers1api:production`
- `docker pull ghcr.io/elfensky/helldivers1api:latest`
