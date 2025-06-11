'use client';
import { useRef } from 'react';
import Script from 'next/script';
import Map from '@/components/h1/Galaxy/Map';
import Tooltip from '@/components/h1/Galaxy/Tooltip';
//enums
import factions from '@/enums/factions';
import map from '@/enums/map';
//time
import { elapsedSeasonTime } from '@/utils/time';

export default function Galaxy({ data, rebroadcast }) {
    const svgRef = useRef(null);
    const json = rebroadcast?.data?.data?.json;

    processCampaigns(data);
    const elapsedTime = elapsedSeasonTime(data?.statistics[0]?.season_duration);

    // console.log(map);

    return (
        <>
            <section
                id="galaxy"
                // flex w-full max-w-[800px] flex-grow flex-col justify-center
                className="flex flex-grow-[4] flex-col gap-4"
            >
                <div className="flex flex-row gap-2 text-3xl uppercase">
                    <h1>Season {data.season}</h1>
                    <span>|</span>
                    <span>Day {elapsedTime.days}</span>
                </div>
                <Map svgRef={svgRef} map={map} />
                <Tooltip svgRef={svgRef} data={data} map={map} />
                {/* <Script src="/scripts/animateMap.js" strategy="lazyOnload" /> */}
            </section>
        </>
    );
}

function processCampaigns(data) {
    data?.campaigns?.forEach((campaign, faction) => {
        const sector_count = 10; //10 sectors, 11th (homeworld) is determined by the attack event, not campaign progress.
        const points_max = campaign?.points_max;
        const points = campaign?.points;
        const points_per_sector = points_max / sector_count;

        const sectors_earned = Math.trunc(points / points_per_sector);
        const sectors_in_progress = sectors_earned + 1;
        const sectors_remaining = sector_count - sectors_earned - 1;

        for (const region in map[faction]) {
            const total_points_for_sector = region * points_per_sector;

            if (region === '11') {
                if (campaign.status === 'defeated') {
                    map[faction][region].status = 'captured';
                    map[faction][region].percent = 100;
                } else {
                    //calculate based on current attack event if any.
                }
                //
            } else if (region === sectors_in_progress.toString()) {
                //if in progress, calculate module difference
                const remaining_points =
                    points - (total_points_for_sector - points_per_sector);

                map[faction][region].status = 'active';
                map[faction][region].points = points;
                map[faction][region].points_max = total_points_for_sector;
                map[faction][region].points_sector = remaining_points;
                map[faction][region].points_sector_max = points_per_sector;
                //percentage
                const percent = (remaining_points / points_per_sector) * 100;
                map[faction][region].percent = percent;
                //
            } else if (region <= sectors_earned) {
                //if captured, simply use the totals per sector.
                map[faction][region].status = 'captured';
                map[faction][region].points = total_points_for_sector;
                map[faction][region].points_max = total_points_for_sector;
                map[faction][region].points_sector = points_per_sector;
                map[faction][region].points_sector_max = points_per_sector;
                //percentage
                const percent = (total_points_for_sector / total_points_for_sector) * 100;
                map[faction][region].percent = percent;
                //
            } else {
                //if it's here, it hasn't been reached yet, and the points are 0;
                map[faction][region].status = 'lost';
                map[faction][region].points = points;
                map[faction][region].points_max = total_points_for_sector;
                map[faction][region].points_sector = 0;
                map[faction][region].points_sector_max = points_per_sector;
                //percentage
                map[faction][region].percent = 0;
            }
        }
    });
}
