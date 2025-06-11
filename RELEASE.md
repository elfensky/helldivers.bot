## 0.6.3 (2025-06-11)

- add human readable time to attack and defend events
- add progress bar with points and percentage
- add event type icons

## 0.6.2 (2025-06-11)

- remove console.logs
- fix bug showing 0% Sol System
- rename layout2 to layout
- remove footer (temporarily)
- add season time
- track api calls as events instead of page visits.
- initialize.env.mjs - check if all .env variables are set.
- add proper favicons
- fix layout

## 0.6.1 (2025-06-09)

- Fixes to get Docker working (again).
- Responsive fixes
- code split Galaxy into:
    - Galaxy.jsx
        - Map.jsx & Map.css
        - Tooltip.jsx & Tooltip.css
- Adjust Tooltop
    - show percentage bar
    - show points earned/max
- Adjust Timeline
    - proper styling
- Create War Stats

## 0.6.0 (2025-06-09)

- Update Galaxy.jsx functionality

    - show captured regions (yellow border, yellow color)
    - show in_progress region (gold border, faction color)
    - show lost region (dark/transparent)
    - hover tooltip over regions to show region name

- Create Timeline.jsx component
    - show list of all defend/attack events, sorted by start_time
