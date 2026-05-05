// ============================================================
// DISCRETE-EVENT SIMULATION ENGINE
// Patient-Flow Triage DES with Poisson arrivals,
// severity mix, escalation logic, AI confidence degradation,
// failure boundary classification, and Monte Carlo support.
// ============================================================

// ---- Seeded PRNG (mulberry32) ----
function seededRNG(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---- Poisson sample (Knuth) ----
function poissonSample(lambda, rng) {
    if (lambda <= 0) return 0;
    const L = Math.exp(-Math.min(lambda, 30));
    let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
}

// ---- Sample severity from mix ----
function sampleSeverity(mix, rng) {
    const r = rng();
    if (r < mix.low) return 'low';
    if (r < mix.low + mix.medium) return 'medium';
    if (r < mix.low + mix.medium + mix.high) return 'high';
    return 'critical';
}

// ---- Failure zone classifier ----
function classifyZone(m, thr) {
    let score = 0;
    if (m.avgWaitMin     > thr.maxAvgWaitMin)        score += 1;
    if (m.criticalDelMin > thr.maxCriticalDelayMin)   score += 2;
    if (m.escalSucc      < thr.minEscalationSuccess)  score += 2;
    if (m.dropRate       > thr.maxDropRate)            score += 1;
    if (m.clinUtil       > thr.maxClinicianUtil)       score += 1;
    if (score === 0) return 'green';
    if (score <= 1)  return 'yellow';
    if (score <= 3)  return 'orange';
    return 'red';
}

// ---- Compute percentile from sorted array ----
function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor(p / 100 * sorted.length));
    return sorted[idx];
}

// ============================================================
// TRIAGE SIMULATION CLASS
// ============================================================
class TriageSimulation {
    constructor(arch, scenario, params, rng) {
        this.arch = arch;
        this.scenario = scenario;
        this.params = params;
        this.rng = rng;

        // Apply resource multiplier
        const rm = scenario.resourceMultiplier || 1.0;
        this.nAI  = Math.max(1, Math.round(arch.aiNodes * rm));
        this.nClin = Math.max(1, Math.round(arch.clinicians * rm));
        this.qCap = Math.max(10, Math.round(arch.queueCap * rm));

        // Node pools
        this.aiNodes    = Array.from({ length: this.nAI   }, () => ({ busy: false, freeAt: 0, patient: null }));
        this.clinNodes  = Array.from({ length: this.nClin }, () => ({ busy: false, freeAt: 0, patient: null }));

        // Queues
        this.aiQueue   = [];
        this.clinQueue = [];

        // Counters
        this.pid = 0;
        this.arrived = 0;
        this.served = 0;
        this.dropped = 0;
        this.escalNeeded = 0;
        this.escalSuccess = 0;
        this.critArrived = 0;
        this.critServed = 0;
        this.critTotalDelaySec = 0;
        this.clinBusySec = 0;

        // Window buffers (reset each minute)
        this.wWaits = [];
        this.wCritDels = [];

        // Output
        this.timeSeries = [];   // one entry per minute
        this.zoneHistory = [];
        this.timeToZone = { yellow: null, orange: null, red: null };
    }

    // ---- Run complete simulation ----
    run(thresholds, arrivalOverride) {
        const durationSec = this.params.durationMin * 60;
        const baseRate = this.scenario.arrivalRatePerMin * (arrivalOverride || 1.0);
        const lambdaSec = baseRate / 60;

        for (let t = 0; t < durationSec; t++) {
            this._arrivals(t, lambdaSec);
            this._tickAI(t);
            this._tickClin(t);

            // Record metrics once per minute
            if ((t + 1) % 60 === 0) {
                const min = (t + 1) / 60;
                const m = this._metrics(t + 1);
                this.timeSeries.push({ min, ...m });

                const zone = classifyZone(m, thresholds);
                this.zoneHistory.push(zone);

                if (zone !== 'green' && !this.timeToZone.yellow)  this.timeToZone.yellow  = min;
                if ((zone === 'orange' || zone === 'red') && !this.timeToZone.orange) this.timeToZone.orange = min;
                if (zone === 'red' && !this.timeToZone.red)        this.timeToZone.red     = min;

                this.wWaits = [];
                this.wCritDels = [];
            }
        }
        return this._finalize(durationSec);
    }

    _arrivals(t, lambdaSec) {
        const n = poissonSample(lambdaSec, this.rng);
        for (let i = 0; i < n; i++) {
            this.arrived++;
            if (this.aiQueue.length + this.clinQueue.length >= this.qCap) {
                this.dropped++;
                continue;
            }
            const sev = sampleSeverity(this.scenario.severityMix, this.rng);
            if (sev === 'critical') this.critArrived++;
            this.aiQueue.push({ id: ++this.pid, sev, arrTime: t, outcome: 'pending' });
        }
    }

    _aiConf(queueLoad) {
        const loadFactor = Math.min(1, queueLoad / this.qCap);
        const base = this.arch.aiBaseConfidence - this.arch.confidenceDegradation * loadFactor;
        return Math.max(0.40, Math.min(1, base + (this.rng() - 0.5) * 0.06));
    }

    _tickAI(t) {
        this.aiNodes.forEach(node => {
            if (node.busy && t >= node.freeAt) {
                const p = node.patient;
                const conf = this._aiConf(this.aiQueue.length + this.clinQueue.length);
                p.conf = conf;

                // Escalation decision
                const mustEscalate = (p.sev === 'critical' || p.sev === 'high')
                    || (conf < this.arch.uncertaintyThreshold);

                if (mustEscalate) {
                    this.escalNeeded++;
                    if (this.clinQueue.length < this.qCap) {
                        p.escTime = t;
                        this.clinQueue.push(p);
                        // Priority: critical first
                        this.clinQueue.sort((a, b) => {
                            const o = { critical: 0, high: 1, medium: 2, low: 3 };
                            return o[a.sev] - o[b.sev];
                        });
                    } else {
                        if (p.sev === 'critical') { /* missed critical */ }
                        p.outcome = 'dropped';
                        this.dropped++;
                    }
                } else {
                    const wait = t - p.arrTime;
                    this.wWaits.push(wait);
                    p.outcome = 'served_ai';
                    this.served++;
                }
                node.busy = false;
                node.patient = null;
            }
            if (!node.busy && this.aiQueue.length > 0) {
                const p = this.aiQueue.shift();
                node.busy = true;
                node.patient = p;
                const jitter = 0.7 + this.rng() * 0.6;
                node.freeAt = t + Math.ceil(this.arch.aiProcessSeconds * jitter);
            }
        });
    }

    _tickClin(t) {
        let busyCount = 0;
        this.clinNodes.forEach(c => {
            if (c.busy) {
                busyCount++;
                if (t >= c.freeAt) {
                    const p = c.patient;
                    const wait = t - p.arrTime;
                    this.wWaits.push(wait);
                    this.served++;
                    this.escalSuccess++;
                    p.outcome = 'served_clin';
                    if (p.sev === 'critical') {
                        this.critServed++;
                        this.critTotalDelaySec += wait;
                        this.wCritDels.push(wait);
                    }
                    c.busy = false;
                    c.patient = null;
                    busyCount--;
                }
            }
            if (!c.busy && this.clinQueue.length > 0) {
                c.patient = this.clinQueue.shift();
                c.busy = true;
                const jitter = 0.75 + this.rng() * 0.5;
                c.freeAt = t + Math.ceil(this.arch.clinicianServiceSeconds * jitter);
                busyCount++;
            }
        });
        this.clinBusySec += busyCount;
    }

    _metrics(t) {
        const avgWait = this.wWaits.length
            ? this.wWaits.reduce((a, b) => a + b, 0) / this.wWaits.length / 60 : 0;
        const critDel = this.wCritDels.length
            ? this.wCritDels.reduce((a, b) => a + b, 0) / this.wCritDels.length / 60 : 0;

        const qTotal = this.aiQueue.length + this.clinQueue.length;
        const qCrit  = [...this.aiQueue, ...this.clinQueue].filter(p => p.sev === 'critical').length;
        const qClin  = this.clinQueue.length;

        const escalSucc = this.escalNeeded > 0
            ? (this.escalSuccess / this.escalNeeded * 100) : 100;
        const dropRate = this.arrived > 0
            ? (this.dropped / this.arrived * 100) : 0;
        const clinUtil = t > 0
            ? Math.min(100, (this.clinBusySec / (t * this.nClin)) * 100) : 0;
        const aiConf = (this.arch.aiBaseConfidence
            - this.arch.confidenceDegradation * Math.min(1, qTotal / this.qCap)) * 100;

        const safetyScore = Math.max(0, Math.min(100,
            escalSucc * 0.40
            + (100 - Math.min(100, dropRate * 4)) * 0.30
            + (critDel <= 10 ? 100 : Math.max(0, 100 - (critDel - 10) * 5)) * 0.30
        ));

        return {
            avgWaitMin: +avgWait.toFixed(3),
            criticalDelMin: +critDel.toFixed(3),
            critDelMin: +critDel.toFixed(3),
            qTotal, qCrit, qClin,
            escalSucc: +escalSucc.toFixed(2),
            dropRate: +dropRate.toFixed(2),
            clinUtil: +clinUtil.toFixed(2),
            aiConf: +aiConf.toFixed(1),
            safetyScore: +safetyScore.toFixed(1),
            arrived: this.arrived,
            served: this.served,
            dropped: this.dropped,
        };
    }

    _finalize(durationSec) {
        const last = this.timeSeries.length
            ? this.timeSeries[this.timeSeries.length - 1]
            : this._metrics(durationSec);

        const greenCount = this.zoneHistory.filter(z => z === 'green').length;
        const resilienceScore = this.zoneHistory.length
            ? (greenCount / this.zoneHistory.length * 100) : 100;

        const avgCritDelMin = this.critServed > 0
            ? (this.critTotalDelaySec / this.critServed / 60) : 0;

        const speedScore = Math.max(0, 100 - last.avgWaitMin * 8);
        const complexityScore = this.arch.complexity * 10;

        return {
            archId: this.arch.id,
            archName: this.arch.name,
            scenarioId: this.scenario.id,
            timeSeries: this.timeSeries,
            zoneHistory: this.zoneHistory,
            timeToZone: this.timeToZone,
            summary: {
                avgWaitMin:       last.avgWaitMin,
                criticalDelayMin: avgCritDelMin,
                escalationSuccess: last.escalSucc,
                dropRate:         last.dropRate,
                clinicianUtil:    last.clinUtil,
                safetyScore:      last.safetyScore,
                resilienceScore:  +resilienceScore.toFixed(1),
                speedScore:       +speedScore.toFixed(1),
                complexityScore:  complexityScore,
                totalArrived:     this.arrived,
                totalServed:      this.served,
                totalDropped:     this.dropped,
                finalZone:        this.zoneHistory[this.zoneHistory.length - 1] || 'green'
            }
        };
    }
}

// ============================================================
// MONTE CARLO RUNNER
// Returns { p10, p50, p90 } per time-step for key metrics
// ============================================================
function runMonteCarlo(arch, scenario, params, thresholds, nRuns) {
    const metricKeys = ['avgWaitMin', 'criticalDelMin', 'dropRate', 'clinUtil', 'escalSucc', 'safetyScore'];
    const durationMin = params.durationMin;

    // Accumulators: [minute][metricKey] = [values across runs]
    const acc = Array.from({ length: durationMin }, () => {
        const o = {};
        metricKeys.forEach(k => o[k] = []);
        return o;
    });

    const summaries = [];

    for (let r = 0; r < nRuns; r++) {
        const rng = seededRNG(params.seed + r * 1000);
        const sim = new TriageSimulation(arch, scenario, params, rng);
        const result = sim.run(thresholds);
        summaries.push(result.summary);

        result.timeSeries.forEach((entry, i) => {
            if (i < durationMin) {
                metricKeys.forEach(k => {
                    if (entry[k] !== undefined) acc[i][k].push(entry[k]);
                });
            }
        });
    }

    // Compute percentiles per minute
    const bands = acc.map((minute, i) => {
        const o = { min: i + 1 };
        metricKeys.forEach(k => {
            const sorted = [...minute[k]].sort((a, b) => a - b);
            o[k] = {
                p10: percentile(sorted, 10),
                p50: percentile(sorted, 50),
                p90: percentile(sorted, 90),
            };
        });
        return o;
    });

    // Summary stats across runs
    const summaryBands = {};
    const sumKeys = ['avgWaitMin', 'criticalDelayMin', 'escalationSuccess', 'dropRate', 'resilienceScore', 'safetyScore'];
    sumKeys.forEach(k => {
        const vals = summaries.map(s => s[k]).filter(v => v != null).sort((a, b) => a - b);
        summaryBands[k] = {
            p10: percentile(vals, 10),
            p50: percentile(vals, 50),
            p90: percentile(vals, 90),
        };
    });

    return { bands, summaryBands, nRuns };
}

// ============================================================
// FAILURE BOUNDARY MAP GENERATOR
// Sweeps arrivalRate × clinicianCount and records final zone
// ============================================================
function buildFailureBoundaryMap(arch, scenario, params, thresholds) {
    const arrivalRates  = [1, 2, 4, 6, 8, 10, 12, 16, 20, 25];
    const clinCounts    = [1, 2, 3, 4, 5, 6, 8, 10];
    const grid = [];

    arrivalRates.forEach(rate => {
        clinCounts.forEach(nClin => {
            const rng = seededRNG(params.seed);
            const archCopy = { ...arch, clinicians: nClin };
            const sim = new TriageSimulation(archCopy, scenario,
                { ...params, durationMin: Math.min(params.durationMin, 30) }, rng);
            const result = sim.run(thresholds, rate / scenario.arrivalRatePerMin);
            grid.push({
                arrivalRate: rate,
                clinicians:  nClin,
                zone:        result.summary.finalZone,
                safetyScore: result.summary.safetyScore
            });
        });
    });

    return { arrivalRates, clinCounts, grid };
}

// ============================================================
// GLOBAL SIMULATION STATE
// ============================================================
const SimState = {
    isRunning:      false,
    results:        null,   // array of arch results
    mcResults:      null,   // MC bands per arch
    boundaryMaps:   null,   // boundary map per arch
    params: {
        durationMin:     30,
        seed:            42,
        mcRuns:          20,
        arrivalOverride: 1.0,
        severityMix:     { low: 0.50, medium: 0.30, high: 0.15, critical: 0.05 }
    },
    thresholds: { ...DEFAULT_THRESHOLDS },
    selectedScenario: 'normal',
    selectedArchIds:  ['centralized', 'human_loop', 'hybrid'],
    eventLog: []
};
