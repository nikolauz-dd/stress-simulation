// ============================================================
// CONFIG
// ============================================================
const MODEL_CONFIGS = [
    { id: 'm0', name: 'Gemini 1.5 Flash', speed: 150,  acc: 0.80, nodes: 1, color: '#3b82f6' },
    { id: 'm1', name: 'DeepSeek V2',       speed: 400,  acc: 0.85, nodes: 1, color: '#8b5cf6' },
    { id: 'm2', name: 'GPT-4o',            speed: 600,  acc: 0.92, nodes: 3, color: '#10b981' },
    { id: 'm3', name: 'Claude 3 Opus',     speed: 1200, acc: 0.98, nodes: 3, color: '#f59e0b' },
];

const SCENARIOS = [
    { name: 'Normal',  rate: 60  },
    { name: 'Stress',  rate: 240 },
    { name: 'Extreme', rate: 600 },
];

const TOTAL_DURATION_MS = 60000; // 1 menit, semua skenario berjalan bersamaan
const MAX_QUEUE = 50;
const TICK_RATE = 50;

// ============================================================
// AI SYSTEM CLASS (no DOM refs, pure data)
// ============================================================
class AISystem {
    constructor(speed, acc, nodes) {
        this.speed = speed; this.acc = acc;
        this.queue = [];
        this.nodes = Array.from({ length: nodes }, () => ({
            isBusy: false, timeUntilFree: 0, currentPatient: null
        }));
        this.errors = 0; this.totalReceived = 0;
        this.totalProcessed = 0; this.correctCount = 0;
        this.windowDelays = []; this.patientsFinished = 0;
        this.finalMetrics = null;
    }

    addPatient(p) {
        this.totalReceived++;
        if (this.queue.length >= MAX_QUEUE) { this.errors++; return false; }
        this.queue.push(p);
        return true;
    }

    tick(t) {
        this.nodes.forEach(node => {
            if (node.isBusy) {
                node.timeUntilFree -= TICK_RATE;
                if (node.timeUntilFree <= 0) {
                    this.patientsFinished++;
                    this.totalProcessed++;
                    if (node.currentPatient.isCorrect) this.correctCount++;
                    node.isBusy = false; node.currentPatient = null;
                }
            }
            if (!node.isBusy && this.queue.length > 0) {
                const p = this.queue.shift();
                this.windowDelays.push(t - p.arrivalTime);
                node.isBusy = true; node.currentPatient = p;
                const v = this.speed * 0.2;
                node.timeUntilFree = this.speed + (Math.random() * v * 2 - v);
            }
        });
    }

    aggregate() {
        const avgDelayMs = this.windowDelays.length > 0
            ? this.windowDelays.reduce((a, b) => a + b, 0) / this.windowDelays.length : 0;
        const throughput  = this.patientsFinished * 60;
        const accuracyPct = this.totalProcessed > 0 ? (this.correctCount / this.totalProcessed * 100) : 100;
        const dropPct     = this.totalReceived  > 0 ? (this.errors / this.totalReceived * 100) : 0;
        this.windowDelays = []; this.patientsFinished = 0;
        return { avgDelayS: avgDelayMs / 1000, throughput, accuracyPct, dropPct };
    }

    finalize() {
        const m = this.aggregate();
        const ok = { delay: m.avgDelayS < 5, acc: m.accuracyPct > 90, drop: m.dropPct < 5 };
        const fails = [!ok.delay, !ok.acc, !ok.drop].filter(Boolean).length;
        const status = fails === 0 ? 'Stable' : fails === 1 ? 'Degraded' : 'Failed';
        this.finalMetrics = { ...m, ok, status, dropped: this.errors };
        return this.finalMetrics;
    }

    reset() {
        this.queue = [];
        this.nodes.forEach(n => { n.isBusy = false; n.timeUntilFree = 0; n.currentPatient = null; });
        this.errors = 0; this.totalReceived = 0; this.totalProcessed = 0;
        this.correctCount = 0; this.windowDelays = []; this.patientsFinished = 0;
        this.finalMetrics = null;
    }
}

// ============================================================
// 12 SYSTEMS: allSystems[scenIdx][modelIdx]
// ============================================================
let allSystems = SCENARIOS.map(() =>
    MODEL_CONFIGS.map(cfg => new AISystem(cfg.speed, cfg.acc, cfg.nodes))
);

// ============================================================
// CHARTS: allCharts[scenIdx][modelIdx]
// ============================================================
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = 'Outfit';

const allCharts = SCENARIOS.map((scen, si) =>
    MODEL_CONFIGS.map((cfg, mi) => {
        const ctx = document.getElementById(`chart-s${si}-m${mi}`).getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Delay(s)', data: [], borderColor: cfg.color,
                      backgroundColor: cfg.color + '22', fill: true, tension: 0.3,
                      pointRadius: 0, yAxisID: 'y' },
                    { label: 'Throughput', data: [], borderColor: '#475569',
                      borderDash: [3, 2], tension: 0.3, pointRadius: 0, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 0 },
                plugins: { legend: { display: false } },
                scales: {
                    x:  { display: false },
                    y:  { position: 'left',  ticks: { font: { size: 9 } } },
                    y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 9 } } }
                }
            }
        });
    })
);

// ============================================================
// SIMULATION STATE
// ============================================================
let isRunning = false;
let currentTime = 0;
let patientIdCounter = 1;
let tickInterval, aggInterval, simTimeout;

// ============================================================
// PATIENT GENERATORS (one per scenario, independent rates)
// ============================================================
function startPatientGenerator(si) {
    if (!isRunning) return;
    const rate = SCENARIOS[si].rate;
    const data = patientDataset[Math.floor(Math.random() * patientDataset.length)];
    allSystems[si].forEach(sys => {
        sys.addPatient({ id: patientIdCounter, arrivalTime: currentTime, isCorrect: Math.random() < sys.acc });
    });

    // Only log Normal scenario patients for display
    if (si === 0) {
        const elLogs = document.getElementById('patient-logs');
        while (elLogs.children.length >= 10) elLogs.removeChild(elLogs.lastChild);
        const ok = Math.random() < MODEL_CONFIGS[0].acc;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>#${patientIdCounter}</td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${data.keluhan}">${data.keluhan}</td>
            <td>${data.kondisiAsli}</td><td>${data.kondisiAsli}</td>
            <td class="${ok ? 'status-success':'status-error'}">${ok ? 'Tepat':'Meleset'}</td>`;
        elLogs.insertBefore(tr, elLogs.firstChild);
        patientIdCounter++;
    }

    if (isRunning) setTimeout(() => startPatientGenerator(si), 60000 / rate);
}

// ============================================================
// TICK & AGGREGATE
// ============================================================
function simulationTick() {
    if (!isRunning) return;
    currentTime += TICK_RATE;
    allSystems.forEach(row => row.forEach(sys => sys.tick(currentTime)));

    const remaining = Math.max(0, TOTAL_DURATION_MS - currentTime);
    const secs = Math.floor(remaining / 1000);
    document.getElementById('sim-timer').textContent =
        `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
}

function aggregateData() {
    if (!isRunning) return;
    allSystems.forEach((row, si) => {
        row.forEach((sys, mi) => {
            const m = sys.aggregate();
            const ch = allCharts[si][mi];
            ch.data.labels.push('');
            ch.data.datasets[0].data.push(m.avgDelayS);
            ch.data.datasets[1].data.push(m.throughput);
            ch.update('none');

            // Update metric cards (Extreme row, si=2, is last — shows worst case)
            const cfg = MODEL_CONFIGS[mi];
            document.getElementById(`${cfg.id}-delay`).textContent      = m.avgDelayS.toFixed(2) + 's';
            document.getElementById(`${cfg.id}-throughput`).textContent  = m.throughput + ' p/m';
            document.getElementById(`${cfg.id}-accuracy`).textContent    = m.accuracyPct.toFixed(1) + '%';
            document.getElementById(`${cfg.id}-errors`).textContent      = sys.errors;
        });
    });
}

// ============================================================
// CONTROLS
// ============================================================
document.getElementById('btn-start').addEventListener('click', () => {
    isRunning   = true;
    currentTime = 0;
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-stop').disabled  = false;

    // Mark all 3 scenario steps as active simultaneously
    SCENARIOS.forEach((_, i) => {
        const el = document.getElementById(`step-${i}`);
        el.classList.remove('done');
        el.classList.add('active');
        document.getElementById(`rlabel-${i}`).classList.add('active');
        MODEL_CONFIGS.forEach((_, mi) => {
            document.getElementById(`chart-s${i}-m${mi}`).parentElement.classList.add('active-scenario');
        });
    });
    document.getElementById('scenario-label').textContent = 'Semua skenario berjalan bersamaan';

    // Start all 3 patient generators simultaneously
    SCENARIOS.forEach((_, si) => startPatientGenerator(si));

    tickInterval = setInterval(simulationTick, TICK_RATE);
    aggInterval  = setInterval(aggregateData, 1000);

    // Auto-stop after 60s
    simTimeout = setTimeout(finishSimulation, TOTAL_DURATION_MS);
});

document.getElementById('btn-stop').addEventListener('click', () => {
    isRunning = false;
    clearInterval(tickInterval); clearInterval(aggInterval); clearTimeout(simTimeout);
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled  = true;
});

document.getElementById('btn-reset').addEventListener('click', () => {
    isRunning = false;
    clearInterval(tickInterval); clearInterval(aggInterval); clearTimeout(simTimeout);
    currentTime = 0; patientIdCounter = 1;

    allSystems.forEach(row => row.forEach(s => s.reset()));
    allCharts.forEach(row => row.forEach(ch => {
        ch.data.labels = [];
        ch.data.datasets.forEach(ds => ds.data = []);
        ch.update('none');
    }));

    SCENARIOS.forEach((_, i) => {
        document.getElementById(`step-${i}`).classList.remove('active', 'done');
        document.getElementById(`rlabel-${i}`).classList.remove('active');
        document.getElementById(`rstatus-${i}`).textContent = '—';
        MODEL_CONFIGS.forEach((_, mi) => {
            document.getElementById(`chart-s${i}-m${mi}`).parentElement.classList.remove('active-scenario');
        });
    });

    MODEL_CONFIGS.forEach(cfg => {
        document.getElementById(`${cfg.id}-delay`).textContent      = '—';
        document.getElementById(`${cfg.id}-throughput`).textContent  = '—';
        document.getElementById(`${cfg.id}-accuracy`).textContent    = '—';
        document.getElementById(`${cfg.id}-errors`).textContent      = '0';
    });

    document.getElementById('sim-timer').textContent    = '01:00';
    document.getElementById('scenario-label').textContent = '—';
    document.getElementById('patient-logs').innerHTML   = '';
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled  = true;
});

// ============================================================
// FINISH & EXPORT
// ============================================================
function finishSimulation() {
    isRunning = false;
    clearInterval(tickInterval); clearInterval(aggInterval);

    SCENARIOS.forEach((_, i) => {
        document.getElementById(`step-${i}`).classList.remove('active');
        document.getElementById(`step-${i}`).classList.add('done');
        document.getElementById(`rlabel-${i}`).classList.remove('active');
        MODEL_CONFIGS.forEach((_, mi) => {
            document.getElementById(`chart-s${i}-m${mi}`).parentElement.classList.remove('active-scenario');
        });

        // Show status summary per row
        const counts = { Stable: 0, Degraded: 0, Failed: 0 };
        allSystems[i].forEach(sys => {
            const m = sys.finalize();
            counts[m.status]++;
        });
        document.getElementById(`rstatus-${i}`).textContent =
            `✅${counts.Stable} ⚠️${counts.Degraded} ❌${counts.Failed}`;
    });

    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled  = true;
    document.getElementById('sim-timer').textContent = '00:00';
    document.getElementById('scenario-label').textContent = 'Selesai ✓';

    exportResultsFile();
}

function exportResultsFile() {
    const now = new Date().toLocaleString('id-ID');
    let rows = '';

    SCENARIOS.forEach((scen, si) => {
        rows += `<tr class="sh"><td colspan="7"><strong>📊 Skenario: ${scen.name} — ${scen.rate} pasien/menit (simultan)</strong></td></tr>`;
        allSystems[si].forEach((sys, mi) => {
            const r = sys.finalMetrics;
            if (!r) return;
            const sc = r.status === 'Stable' ? 'stable' : r.status === 'Degraded' ? 'degraded' : 'failed';
            const icon = r.status === 'Stable' ? '✅' : r.status === 'Degraded' ? '⚠️' : '❌';
            rows += `<tr>
                <td><strong>${MODEL_CONFIGS[mi].name}</strong><br><small>${MODEL_CONFIGS[mi].speed}ms · ${MODEL_CONFIGS[mi].nodes} node(s)</small></td>
                <td class="${r.ok.delay?'pass':'fail'}">${r.avgDelayS.toFixed(2)}s</td>
                <td>${r.throughput} pts/min</td>
                <td class="${r.ok.acc?'pass':'fail'}">${r.accuracyPct.toFixed(1)}%</td>
                <td class="${r.ok.drop?'pass':'fail'}">${r.dropped} (${r.dropPct.toFixed(1)}%)</td>
                <td><span class="badge ${sc}">${icon} ${r.status}</span></td>
            </tr>`;
        });
    });

    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Benchmark Results – AI Triage</title>
<style>
body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#f8fafc;padding:2rem}
h1{font-size:1.8rem;color:#60a5fa;margin-bottom:.25rem}p{color:#94a3b8;margin-bottom:1.5rem}
.criteria{background:#1e293b;border-radius:8px;padding:.7rem 1.2rem;margin-bottom:1.5rem;display:inline-flex;gap:2rem;font-size:.9rem}
table{width:100%;border-collapse:collapse;font-size:.92rem}
th{background:#1e293b;color:#94a3b8;text-transform:uppercase;font-size:.78rem;padding:10px 14px;text-align:left}
td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
tr.sh td{background:rgba(59,130,246,.15);color:#60a5fa;font-size:1rem}
.pass{color:#10b981;font-weight:600}.fail{color:#ef4444;font-weight:600}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-weight:600;font-size:.82rem}
.stable{background:rgba(16,185,129,.2);color:#10b981;border:1px solid #10b981}
.degraded{background:rgba(245,158,11,.2);color:#f59e0b;border:1px solid #f59e0b}
.failed{background:rgba(239,68,68,.2);color:#ef4444;border:1px solid #ef4444}
small{color:#94a3b8}
</style></head><body>
<h1>AI Triage – Benchmark Results</h1>
<p>Dihasilkan: ${now} · Durasi: 1 menit · Semua skenario berjalan <strong>simultan</strong></p>
<div class="criteria"><span>✅ Delay &lt; 5s</span><span>✅ Accuracy &gt; 90%</span><span>✅ Dropped &lt; 5%</span></div>
<table><thead><tr>
<th>Model</th><th>Avg Delay</th><th>Throughput</th><th>Accuracy</th><th>Dropped</th><th>Status</th>
</tr></thead><tbody>${rows}</tbody></table></body></html>`;

    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([html], { type: 'text/html' })),
        download: `benchmark_${Date.now()}.html`
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
