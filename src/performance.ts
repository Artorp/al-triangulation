/**
 * @example
 *     const perf = new Perf();
 *     perf.start();
 *     // do something
 *     perf.stop();
 *     console.log(perf.durationPretty())
 */
class Perf {
    t0: number;
    t1: number;

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
     * @param job_name
     */
    stopAndPrint(job_name: string) {
        this.t1 = Date.now();
        console.log(`${job_name} took ${this.durationPretty()}.`);
    }

    duration(): number {
        return this.t1 - this.t0;
    }

    durationPretty(): string {
        const delta = this.t1 - this.t0;
        if (delta >= 1000) {
            return `${(delta / 1000).toFixed(2)} s`;
        }
        return `${delta} ms`;
    }
}

export { Perf };
