'use client';
import React, { useEffect, useState } from 'react';
// import { tryCatch } from '@/lib/tryCatch.mjs';
// import { query_get_rebroadcast_status } from '@/db/queries/rebroadcast';
import axios from 'axios';

// Example faction name list
const faction_name_list = ['Bugs', 'Cyborgs', 'Illuminates', 'Super Earth'];

function formatTime(seconds) {
    if (seconds < 0) return 'Finished!';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function HelldiversStats() {
    const [data, setData] = useState(null);
    const [timers, setTimers] = useState({}); // { timerId: secondsRemaining }

    // Fetch data on mount
    useEffect(() => {
        const formData = new FormData();
        formData.append('action', 'get_campaign_status');

        axios
            .post('/api/h1/rebroadcast', formData)
            .then((res) => setData(res.data))
            .catch((err) => console.error(err));
    }, []);

    // Timer logic
    useEffect(() => {
        if (!data) return;

        // Collect all timers
        const newTimers = {};

        // Defend event
        if (
            data.defend_event &&
            data.defend_event.status === 'active' &&
            data.defend_event.end_time
        ) {
            const defendId = 'd';
            const seconds = Math.floor(data.defend_event.end_time - Date.now() / 1000);
            newTimers[defendId] = seconds;
        }

        // Attack events
        if (data.attack_events) {
            data.attack_events.forEach((ae) => {
                if (ae.status === 'active' && ae.end_time) {
                    const attackId = `a-${ae.enemy}`;
                    const seconds = Math.floor(ae.end_time - Date.now() / 1000);
                    newTimers[attackId] = seconds;
                }
            });
        }

        setTimers(newTimers);
    }, [data]);

    // Decrement timers every second
    useEffect(() => {
        if (Object.keys(timers).length === 0) return;
        const interval = setInterval(() => {
            setTimers((prev) => {
                const updated = {};
                for (const key in prev) {
                    updated[key] = prev[key] > 0 ? prev[key] - 1 : 0;
                }
                return updated;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [timers]);

    if (!data) return <div>Loading...</div>;

    // Defend String
    let defendString = 'No defend event in progress';
    if (data.defend_event && data.defend_event.status) {
        if (data.defend_event.status === 'active') {
            const p = data.defend_event.points / parseFloat(data.defend_event.points_max);
            const defendId = 'd';
            defendString = (
                <>
                    Defending on {faction_name_list[data.defend_event.enemy]}:{' '}
                    <b>
                        {data.defend_event.points}/{data.defend_event.points_max}
                    </b>{' '}
                    ({(p * 100).toFixed(1)}%) Time Remaining:{' '}
                    <span className="timer" id={`timer-${defendId}`}>
                        {formatTime(timers[defendId] || 0)}
                    </span>
                </>
            );
        } else {
            defendString = (
                <>
                    Last event is <b>{data.defend_event.status}</b> in{' '}
                    {faction_name_list[data.defend_event.enemy]}:{' '}
                    {data.defend_event.points}/{data.defend_event.points_max}
                </>
            );
        }
    }

    // Attack String
    let attackString = [];
    if (data.attack_events) {
        data.attack_events.forEach((ae) => {
            if (ae.status === 'active') {
                const p = ae.points / parseFloat(ae.points_max);
                const attackId = `a-${ae.enemy}`;
                attackString.push(
                    <div key={attackId}>
                        Attacking on {faction_name_list[ae.enemy]}:{' '}
                        <b>
                            {ae.points}/{ae.points_max}
                        </b>{' '}
                        ({(p * 100).toFixed(1)}%) Time Remaining:{' '}
                        <span className="timer" id={`timer-${attackId}`}>
                            {formatTime(timers[attackId] || 0)}
                        </span>
                    </div>,
                );
            } else {
                attackString.push(
                    <div key={`last-${ae.enemy}`}>
                        Last event is <b>{ae.status}</b> in {faction_name_list[ae.enemy]}:{' '}
                        {ae.points}/{ae.points_max}
                    </div>,
                );
            }
        });
    }

    // Campaign String
    let campaignString = [];
    if (data.campaign_status && data.statistics) {
        for (let i = 0; i < 3; i++) {
            const ae = data.campaign_status[i];
            if (ae.status === 'active') {
                const p = ae.points / parseFloat(ae.points_max);
                campaignString.push(
                    <div key={`camp-${i}`}>
                        {faction_name_list[i]} is <b>active</b>:{' '}
                        <b>
                            {ae.points}/{ae.points_max}
                        </b>{' '}
                        ({(p * 100).toFixed(1)}%) current players:{' '}
                        {data.statistics[i].players}
                    </div>,
                );
            } else {
                campaignString.push(
                    <div key={`camp-${i}`}>
                        {faction_name_list[i]} is <b>{ae.status}</b> current players:{' '}
                        {data.statistics[i].players}
                    </div>,
                );
            }
        }
    }

    return (
        <div>
            <h1>Current Defend Events</h1>
            <div>{defendString}</div>
            <br />
            <h1>Current Attack Events</h1>
            <div>{attackString}</div>
            <br />
            <h1>Current Campaign</h1>
            <div>{campaignString}</div>
        </div>
    );
}
