export interface Timer {
  start: [ number, number ];
  stop(): string;
}

/**
 * Convenience method for creating a timer that calculates seconds elapsed to 3 decimal places
 */
export default function timer(): Timer {
  let start = process.hrtime();
  return {
    start,
    /**
     * Stop the timer and return the elapsed seconds to 3 decimal places as a string
     */
    stop() {
      let [ sec, ns ] = process.hrtime(start);
      return (sec + (ns / 1e9)).toFixed(3);
    }
  };
}
