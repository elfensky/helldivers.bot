TODO

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
