#

#

#

#

#

#

#

# **The Unofficial Helldivers API Documentation**

by XTC

(Want to see this API in action? Join us on Discord: [https://discord.gg/8cqDb4B](https://discord.gg/8cqDb4B))

# Table of Contents {#table-of-contents}

[Table of Contents](#table-of-contents)

[Documentation TODO-List:](#documentation-todo-list:)

[Disclaimer](#disclaimer)

[General Infrastructure](#general-infrastructure)

[helldivers.api.wwsga.me](#helldivers.api.wwsga.me)

[api.helldiversgame.com](#api.helldiversgame.com)

[Getting Global Statistics](#getting-global-statistics)

[get_campaign_status](#get_campaign_status)

[campaign_status](#campaign_status)

[defend_event](#defend_event)

[attack_events](#attack_events)

[statistics](#statistics)

[get_usernames](#get_usernames)

[usernames](#usernames)

[get_available_entitlements](#get_available_entitlements)

[get_snapshots](#get_snapshots)

[introduction_order](#introduction_order)

[points_max](#points_max)

[snapshots](#snapshots)

[defend_events](#defend_events)

[attack_events](#attack_events-1)

[get_leaderboards](#get_leaderboards)

[leaderboards](#leaderboards)

# Documentation TODO-List: {#documentation-todo-list:}

- get_campaign_status \- Figure out what max_event_id is
- get_available_entitlements \- tf is this
- get_snapshots: Figure out what max_points is
- get_snapshots \- Confirm ‘success’ and ‘fail’ status
- get_snapshots \- Confirm purpose of players_at_start

#

#

#

#

#

# Disclaimer {#disclaimer}

The HELLDIVERS API servers and the entire API are not intended for third party use. However, experiments with the server as well as the currently running HELLBOT are located in Austria and are, according to §118a, §119 and §119a StGB, not considered illegal data theft. Laws about data theft may vary between countries. The writers behind this documentation do not take responsibility for legal action taken against the usage of the API.

# General Infrastructure {#general-infrastructure}

There are two servers the client connects to, reachable under the following URLs:

- api.helldiversgame.com
- helldivers.api.wwsga.me

## helldivers.api.wwsga.me {#helldivers.api.wwsga.me}

This server is used to store and handle Userdata. It is connected to once when the “Play” button is pressed, starting a new session.  
**Do not connect to this server.**  
Connections are most likely logged and any unauthorized incoming connections may result in a ban if your user account can be identified.

## api.helldiversgame.com {#api.helldiversgame.com}

This server is where global stats are stored. Events and battlefield statistics can all be requested from this server. Commands are sent to api.helldiversgame.com/1.0/ using a POST request, but this will be explained in more detail later.

The client uses the Open Source [libcurl](https://curl.haxx.se/download.html) library for all traffic between the client and the servers. The connections are secured with SSL, and there is a mechanism in play which doesn’t allow programs like Fiddler to decrypt the SSL traffic. This is most likely due to certificate pinning, but that is not confirmed information.

# Getting Global Statistics {#getting-global-statistics}

Global Statistics can be acquired from the api.helldiversgame.com server using https. The full URL is: “[https://api.helldiversgame.com/1.0/](https://api.helldiversgame.com/1.0/)”

If given no POST parameters, the server will return the following:  
{"time":\<unix time\>,"error_code":1,"error_message":"No action set"}

In order to fetch data the request must include an action POST parameter. Valid action values are:

- get_campaign_status
- get_usernames
- get_available_entitlements
- get_snapshots
- get_leaderboards

## get_campaign_status {#get_campaign_status}

The “get_campaign_status” command returns an Object with the following structure:

| Key             | Value                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| time            | Unix Timestamp of Request                                                                                                                                       |
| error_code      | 0                                                                                                                                                               |
| campaign_status | Array of JSON Objects containing general data about the enemy faction’s status(see campaign_status)                                                             |
| defend_event    | JSON Object containing data about defense events, only contains 1 event (see defend_event)                                                                      |
| attack_events   | Array of JSON Objects containing data about attacks on enemy faction home worlds, contains 3 events (the most recent one for every faction) (see attack_events) |
| statistics      | Array of JSON Objects containing general global stats, split up per faction (see statistics)                                                                    |

###

### campaign_status {#campaign_status}

campaign_status is an Array of JSON objects that contains data about the main battlefields of all three factions. They are ordered as follows:

- Index 0 \- Bugs
- Index 1 \- Cyborgs
- Index 2 \- Illuminate

A campaign_status Object contains the following values:

| Key                | Data Type | Value                                                                                                                                  |
| ------------------ | :-------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| season             |  number   | Season / War Number                                                                                                                    |
| points             |  number   | Current amount of influence points gained by players, decreases over time.                                                             |
| points_taken       |  number   | Total amount of influence points gained by players.                                                                                    |
| points_max         |  number   | Required amount of influence points in order to start a home planet assault event.                                                     |
| status             |  string   | Either ‘active’ if there are missions available, ‘defeated’ if the faction has been defeated or ‘hidden’ if war has not been declared. |
| introduction_order |  number   | order in which faction was introduced to the war, 255 if faction hasn’t been introduced yet                                            |

### defend_event {#defend_event}

defend_event is a JSON Object that contains data about the most recent or currently active defense event.

A defend_event Object contains the following values:

| Key        | Data Type | Value                                                                                                                            |
| ---------- | :-------: | -------------------------------------------------------------------------------------------------------------------------------- |
| season     |  number   | Season / War Number                                                                                                              |
| event_id   |  number   | defence event id, probably equal to the total amount of defense events minus 1                                                   |
| start_time |  number   | Unix Timestamp of when the defence event started                                                                                 |
| end_time   |  number   | Unix Timestamp of when the defence event will end and be lost, if the points_max requirement is not met.                         |
| region     |  number   | id of the region in which the planet that has to be defended lies                                                                |
| enemy      |  number   | id of the enemy that is attacking the planet                                                                                     |
| points     |  number   | Current amount of influence points the players have gained                                                                       |
| points_max |  number   | Amount of influence points needed for the defence event to be successful                                                         |
| status     |  string   | Presumably either ‘active’, ‘success’ or ‘failure’, depending on if the event is ongoing, ended in a victory, or ended in a loss |

###

### attack_events {#attack_events}

attack_events is an Array of JSON objects that, for each faction, contain data about the most recent homeplanet assault or, if there is one, the currently active one. They are ordered as follows:

- Index 0 \- Bugs
- Index 1 \- Cyborgs
- Index 2 \- Illuminate

An attack_events Object contains the following values:

| Key              | Data Type | Value                                                                                                                 |
| ---------------- | :-------: | --------------------------------------------------------------------------------------------------------------------- |
| season           |  number   | Season / War Number                                                                                                   |
| event_id         |  number   | Attack event id, probably equal to the total amount of attack events minus 1                                          |
| start_time       |  number   | Unix Timestamp of when the attack event started                                                                       |
| end_time         |  number   | Unix Timestamp of when the attack event will end and be lost, if the points_max requirement isn’t met                 |
| enemy            |  number   | id of the enemy that is being attacked                                                                                |
| points           |  number   | Current amount of influence points the players have gained                                                            |
| points_max       |  number   | Amount of influence points needed for the attack event to be successful                                               |
| status           |  string   | Either ‘active’, ‘success’ or ‘failure’, depending on if the event is ongoing, ended in a victory, or ended in a loss |
| players_at_start |  number   | The amount of players that are in a mission in the region where the defence event starts at the time it started       |
| max_event_id     |  number   | same as event_id? (To identify whether this event is the most current one?)                                           |

### statistics {#statistics}

statistics is an Array of JSON objects that, for each faction, contain data about the performance of the players against that respective faction. All data in a statistics Object is specific for one faction. To get the complete total, you have to sum the statistics of all three factions. They are ordered as follows:

- Index 0 \- Bugs
- Index 1 \- Cyborgs
- Index 2 \- Illuminate

A statistics Object contains the following values:

| Key                      | Data Type | Value                                                      |
| ------------------------ | :-------: | ---------------------------------------------------------- |
| season                   |  number   | Season / War Number                                        |
| season_duration          |  number   | Amount of seconds that the current war has been going on   |
| enemy                    |  number   | The id of the enemy in this region                         |
| players                  |  number   | Amount of players currently online                         |
| total_unique_players     |  number   | Amount of unique players that have fought this season      |
| missions                 |  number   | Amount of missions played                                  |
| successful_missions      |  number   | Amount of missions played that were successful             |
| total_mission_difficulty |  number   | Sum of the mission difficulties of all successful missions |
| completed_planets        |  number   | Amount of planets where all missions were finished         |
| defend_events            |  number   | Amount of defend events                                    |
| successful_defend_events |  number   | Amount of successful defend events                         |
| attack_events            |  number   | Amount of homeplanet assaults                              |
| successful_attack_events |  number   | Amount of homeplanet assaults that resulted in a victory   |
| deaths                   |  number   | Amount of player deaths                                    |
| accidentals              |  number   | Amount of player-caused deaths                             |
| shots                    |  number   | Amount of shots fired                                      |
| hits                     |  number   | Amount of shots hit                                        |
| kills                    |  number   | Amount of enemies killed                                   |

## get_usernames {#get_usernames}

The “get_usernames” command requires three POST parameters:

| Key     | Value                               |
| ------- | ----------------------------------- |
| action  | ‘get_usernames’                     |
| network | ‘steam’ (PC) or ‘psn’ (PlayStation) |
| count   | amount of users to get              |

The command returns an Object with the following structure:

| Key        | Data Type | Value                     |
| ---------- | :-------: | ------------------------- |
| time       |  number   | Unix Timestamp of Request |
| error_code |  number   | 0                         |
| usernames  |   Array   | Array of users            |

### usernames {#usernames}

The usernames-Array is a String array, which contains Hex-Numbers of Steam User-IDs, if the network parameter is set to “steam”. Profiles to these users can be accessed at steamcommunity.com/profiles/\<steam-id-here\>

If the network parameter is set to “psn”, instead of Steam User-IDs the Array will contain plain usernames of PlayStation players.

## get_available_entitlements {#get_available_entitlements}

most probably \-\> DLC availability

## get_snapshots {#get_snapshots}

This command is used to get information regarding the war effort similar to “get_campaign_status”, except in a more concatenated fashion.  
The “get_snapshots” command requires two POST parameters:

| Key    | Value                                         |
| ------ | --------------------------------------------- |
| action | ‘get_snapshots’                               |
| season | the season number you want the snapshots from |

This command returns an Object with the following structure:

| Key                | Data Type | Value                                                                                         |
| ------------------ | :-------: | --------------------------------------------------------------------------------------------- |
| time               |  number   | Unix Timestamp of Request                                                                     |
| error_code         |  number   | 0                                                                                             |
| introduction_order |   Array   | Array containing 3 numbers that show in which order the enemy factions entered the war        |
| points_max         |   Array   | Maximum Points of **???**                                                                     |
| snapshots          |   Array   | An Array containing data from certain points in time                                          |
| defend_events      |   Array   | An Array containing data about finished events on any sectors (except for Homeworld Assaults) |
| attack_events      |   Array   | An Array containing data about finished Homeworld Assaults                                    |

### introduction_order {#introduction_order}

The introduction_order array always contains 3 numbers, these can only be one of the following:

- 0, 1 or 2 if the faction has already started war
- 255 if there is no war between the enemy faction and Super Earth

The indexes in the array correspond to the enemy factions as follows:

- Index 0: Bugs
- Index 1: Cyborgs
- Index 2: The Illuminate

### points_max {#points_max}

An array that contains the points needed to trigger a homeworld assault event, ordered like this:

- Index 0: Bugs
- Index 1: Cyborgs
- Index 2: Illuminate

### snapshots {#snapshots}

A snapshot-Object has 3 properties: A season property, which is a number and shows which war this data is of, a time property which is a timestamp of when the data sample was taken, and a data property, which is an array of objects which are structured as follows:

| Key          | Data Type | Value                                                                                                                |
| ------------ | :-------: | -------------------------------------------------------------------------------------------------------------------- |
| points       |  number   | Points needed to activate homeworld assault                                                                          |
| points_taken |  number   | Points users have already gained                                                                                     |
| status       |  string   | ‘hidden’ if war has not started yet, ‘active’ is war is currently going, **possibly** ‘success’ and ‘fail’/’failure’ |

###

###

### defend_events {#defend_events}

The defend_events Array contains Objects with the following structure:

| Key              | Data Type | Value                                                                                                     |
| ---------------- | :-------: | --------------------------------------------------------------------------------------------------------- |
| season           |  number   | Number showing which war the data is from                                                                 |
| event_id         |  number   | Server-assigned unique ID for the event                                                                   |
| start_time       |  number   | Timestamp of when the event started                                                                       |
| end_time         |  number   | Timestamp of when the event ended                                                                         |
| region           |  number   | Sector in which the event took place, 1 for the closest sector, 12 for the furthest away from Super Earth |
| enemy            |  number   | Number that defines which enemy faction the event was about. 0 \= Bugs, 1 \= Cyborgs, 2 \= Illuminate     |
| points_max       |  number   | Points required to successfully finish the event                                                          |
| points           |  number   | Points that players acquired (= points_max if event was successful)                                       |
| status           |  string   | Either ‘success’ or ‘fail’, based on whether the event was won or not                                     |
| players_at_start |  number   | Amount of players who participated in the event **(?)**                                                   |

###

###

### attack_events {#attack_events-1}

The attack_events Array contains Objects with the following structure:

| Key              | Data Type | Value                                                                                                 |
| ---------------- | :-------: | ----------------------------------------------------------------------------------------------------- |
| season           |  number   | Number showing which war the data is from                                                             |
| event_id         |  number   | Server-assigned unique ID for the event                                                               |
| start_time       |  number   | Timestamp of when the event started                                                                   |
| end_time         |  number   | Timestamp of when the event ended                                                                     |
| enemy            |  number   | Number that defines which enemy faction the event was about. 0 \= Bugs, 1 \= Cyborgs, 2 \= Illuminate |
| points_max       |  number   | Points required to successfully finish the event                                                      |
| points           |  number   | Points that players acquired (= points_max if event was successful)                                   |
| status           |  string   | Either ‘success’ or ‘fail’, based on whether the event was won or not                                 |
| players_at_start |  number   | Amount of players who participated in the event **(?)**                                               |

###

##

## get_leaderboards {#get_leaderboards}

The “get_leaderboards” command requires three POST parameters:

| Key     | Value                                            |
| ------- | ------------------------------------------------ |
| action  | ‘get_leaderboards’                               |
| network | ‘steam’ (PC) or ‘psn’ (PlayStation)              |
| season  | the season number you want the leaderboards from |

There are also two optional parameters:

| Key   | Value                                                              |
| ----- | ------------------------------------------------------------------ |
| count | amount of users you want stats of                                  |
| users | an Array of Steam IDs of users that the leaderboards should return |

This command returns an Object with the following structure:

| Key               | Data Type | Value                                                                                                                                                |
| ----------------- | :-------: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| time              |  number   | Unix Timestamp of Request                                                                                                                            |
| error_code        |  number   | 0                                                                                                                                                    |
| leaderboards      |   Array   | Array of leaderboard objects containing data about players on the leaderboard.                                                                       |
| user_leaderboards |   Array   | Array of leaderboard objects containing leaderboard data of users specified in the users parameter (does not exist if no users parameter is defined) |

### leaderboards {#leaderboards}

The leaderboards-Array is an Array of Arrays. It always contains 4 Arrays, every Array containing leaderboard data for one warfront and one for global leaderboard data. The order goes as follows:

- Index 0 \- Bugs
- Index 1 \- Cyborgs
- Index 2 \- Illuminate
- Index 3 \- Global (All Warfronts)

These Arrays contain JSON Objects that represent leaderboard data. A leaderboard Object has the following structure for the ‘steam’ network option:

| Key       | Data Type | Value                                            |
| --------- | :-------: | ------------------------------------------------ |
| online_id |  string   | Hex number of the users Steam ID                 |
| playtime  |  number   | Playtime of the user in seconds                  |
| planets   |  number   | Amount of liberated planets                      |
| score     |  number   | Amount of Community Points the player has gained |
| player_xp |  number   | Amount of XP Points the player has               |

Data from the ‘psn’ network option has the same structure as shown above, however, instead of a Steam ID the online_id field contains the PSN username of the user.
