/**
 * @example
 *     const perf = new Performance();
 *     perf.start();
 *     // do something
 *     perf.stop();
 *     console.log(perf.durationPretty())
 */
class Performance {
    constructor() {
        this.t0 = 0;
        this.t1 = 0;
    }

    start() {
        this.t0 = Date.now();
    }

    stop() {
        this.t1 = Date.now();
    }

    /**
     * @param {string} job_name
     */
    stopAndPrint(job_name) {
        this.t1 = Date.now();
        console.log(`${job_name} took ${this.durationPretty()}.`);
    }

    duration() {
        return this.t1 - this.t0;
    }

    durationPretty() {
        const delta = this.t1 - this.t0;
        if (delta >= 1000) {
            return `${(delta / 1000).toFixed(2)} s`;
        }
        return `${delta} ms`;
    }
}

module.exports = { Performance };
