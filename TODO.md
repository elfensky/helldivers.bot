What DATA do I want to SHOW?

Homepage /: QUICK UPDATE ON CURRENT SITUATION
--> Current status of MAP (in-game desk view)
--> Current Events as ALERTS on top (mobile under eachtoher, tablet+ next to eachtoher and scrollable)
--> Current campaign (number) and its stats (helldivers online, kills, missions, enemies).
--> use WebSockets to push updates to the page, keeping the data up2date.
--> use Notifications for "offline" alerts about in-game events.

Generate map-data on update, and store it in a h1_map JSON field.
then, the map component and websockets simply poll the latest map field in h1_app table

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

FORGET WAR AND STATS FOR NOW. FOCUS ON GETTING HOMEPAGE GOOD.

.
.
.
.
.
UPDATE DATABASE SCHEMA
I WANT TO SHOW HISTORIC PLAYERCOUNTS (link to sale events etc..) (let users create them, and I have to approve)

1. SEASON
   -> one2many: 15min interval status that gets upserted on every update (helldivers online, total kills, etc..)
2. EVENT
   -> no separate attack/defend event, just event with "type"
   -> one2many: 10min interval status (event progress, maybe also campaign stats) (same table as season?)

War /war/153: HISTORIC DATA AND GRAPHS
--> on load, animate CURRENT WAR PROGRESS upto NOW
--> switch between WARS
--> animate MAP using STATISTICS like in-game

1. Responsive Mobile Menu (go peek at Bolckmans?)
   basically: {width > 780px ? <DesktopMenu /> : <MobileMenu /> }
   --> check if this is still server rendered?

Or just: opacity0 offscreen menu button alyways present
nav items slide up/away on resize. on button press slide down with bg and flex-col
something like that.

--> mobile/desktop have css reveal animation, so time to check if it's desktop or mobile on pageload.

--> signin button different style
--> github logo svg so it can be color hover:stated

Global (tailwind config variable) margins for spacing
Global (tailwind config variable) colors
Global (..) padding
etc...
As little "custom" css as possible.
FIX AND KEEP USING COLOR PALETTE -> Patch the purple/blue-ish to the helldivers yellow/cyan
Add Skulls to places.
Add wings to titles
maybe custo tailwind sizes
DEFINE (somewhere, maybe README) - which sizes are what design
\_\_ -> phone is default
sm -> tablet vertical
md -> tablet horizontal
lg -> desktop (small)
xl -> desktop (large) -> website has a max-width
2xl-> max width no longer applied, flex-row (max width of a 21:9 ultrawide, wider than that it still has max width);
ultrawide? but supports ultrawide displays and goes WIIIDE. that would be super cool imo. Maybe custom design.

1. Big Layout
   START FROM MOBILE TO DESKTOP

- empty Hero with proper sizing (vh90% or something like that) and bg color (linear gradient I guess? try some stuff, check how volta did it?)
- the hero section layout should work, but it should be colored blocks (button to rotate map should work I think).
- empty top content section with chibi.
- How to transition map on mobile? Cut off? See the rest of it? Test.

3. Content Part 1

- fill out hero content with actual interactive content. hovering over alerts should highlight related map section.
- fill out about/features (link to github issues in about).
    - about
        - photoshop me in a helldiver helmet maybe?
        - who am I, why did I built this. Started as a discord bot, ended up as a website.

    - features can mention things in the roadmap
        - map
        - events
        - api? (its own section prob)
        - notifications
        - pwa offline functionality
        - history
        - graphs (advanced hourly history)
        - ...
        - (maybe a vertical accordeon that slides between things |||something|| -> |else ||||) click on vertical slices
        - (like railway but horizontal not vertical)

- update map so hovered sections are highlightable - instead of hovered tile info shows up where alerts go? (on mobile and tablet)

1. Add section flourishes (+++, lines, // etc...)

- flesh out the design in figma. Only top section is blocks imo, rest should be flat on page etc..

1. Roadmap - nice view of planned features and time estimates + link to github roadmap.

nice to have: rotating blinking logo on hover (eg sattelite)

# ONCE WEB APP IS v1.0.0 (finalized)

Build a swiftui webapp with live activities.
-> dynamic island shows in-game event status (attack/defend/...)

How to implement map in swift?
