# TODO

## 0.4.0 (2025-05-13)

- update.js to fetch data from the official api
- Working on the Helldivers API & update function
    - /api/h1/rebroadcast
    -

#### 0.4.1+

- fully remove font-awesome
- create a /utils folder. /lib is too confusing
- add zod for validation
- generate "events" timeline

    - support "defend events"
    - support "attack events"
    - support "region captures"

- add hover tooltip to map
    - use enums or translation.json for content
    - check wiki for region names
    -
- fix map: contested region (only color in gold when 100% completed, if not 100% completed, the region needs to be red)
- add continious updating to map using SetInterval/SetTimeout

    - this means it needs to be SSR'd but then become reactive.
      Need to figure out how that works with Next.js. Maybe useServerSideProps + useClient?

- add "region under attack" to map
- add "completed" to enemy homeworld

#### 0.5.0 (2025-04-XX)

- rework/complete the api structure
    - normalized data into separate tables
    - update function that properly updates (normalized) and (overwritten) status and campaigns etc..
        - that function should be called in (after) on each request if update===true
    - /h1/rebroadcast fixes
        - also saves normalized data
        - update works with all request types (case switch)
        - ...
    - /h1/status
        - shows all (historical) defend/attack events for the season (more data than rebroadcast).
        -

#### 0.6.0 (2025-04-XX)

- sitemap
    - homepage layout
        - show info from /stats + map + more info
        - show info about the discord bot
        - show info about api access
        - header content
        - footer content
    - /bot
        - detailed info about the bot
            - features
            - where to find it
            - ...
        - how to use the bot
        - available commands
    - /api
        - detailed info about the api
        - how to use it
    - /docs
        - swagger docs
-

#### 0.7.0 (2025-04-XX)

- about page
- attribution page

    - export default function Home() {
      return (
      <main className="flex">
      <a
                                                                                                                                                                                                                                                                                                                                                                                                      href="https://www.flaticon.com/free-icons/satellite"
                                                                                                                                                                                                                                                                                                                                                                                                      title="satellite icons"
                                                                                                                                                                                                                                                                                                                                                                                                  >
      Satellite icons created by Freepik - Flaticon
      </a>
      </main>
      );
      }

- admin dashboard to manage api key(s)

    - create api key
    - track api key usage
    - manage allowed hosts (domains) for api key

- superadmin dashboard to manage users & their api key(s)

    - disable/enable user
        - see user list
        - see if user email is verified
        - see user login types
        - ...
    - disable/enable api key
    - block hosts
    - see

- websockets to update clients about new data
-

# 1.0+

- web workers
- web notifications
- websockets (for bot) (request update + response)
- move from manual Dockerfile to Github Actions workflow where it automatically builds, deploys and packages the app.
