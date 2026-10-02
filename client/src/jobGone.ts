/** What a job poller shows when `/api/generate/:id` answers 404: the server restarted, or
 * evicted the job after an hour unread (PLAN.md "Idle Jobs Leave Every Registry"). Unlike a
 * network hiccup, it will never settle, so retrying would show "running" forever. */
export const JOB_GONE = 'the server no longer has this job — it restarted or the job expired';
