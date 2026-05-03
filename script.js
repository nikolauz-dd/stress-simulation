// UI Elements
const elArrivalRate = document.getElementById('arrival-rate');
const elArrivalRateVal = document.getElementById('arrival-rate-val');
const elAiModel = document.getElementById('ai-model');

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnReset = document.getElementById('btn-reset');

// Config
let isRunning = false;
let arrivalRate = parseInt(elArrivalRate.value);
let processingSpeed = parseInt(elAiModel.value);
let aiModelName = elAiModel.options[elAiModel.selectedIndex].getAttribute('data-name');
const MAX_QUEUE = 50;
let patientIdCounter = 1;
const TICK_RATE = 50;

elArrivalRate.addEventListener('input', (e) => {
    arrivalRate = parseInt(e.target.value);
    elArrivalRateVal.value = arrivalRate;
});
elArrivalRateVal.addEventListener('input', (e) => {
    let val = parseInt(e.target.value);
    if (!isNaN(val)) {
        if (val > 1500) val = 1500;
        if (val < 1) val = 1;
        arrivalRate = val;
        elArrivalRate.value = arrivalRate;
    }
});
elAiModel.addEventListener('change', (e) => {
    processingSpeed = parseInt(e.target.value);
    aiModelName = elAiModel.options[elAiModel.selectedIndex].getAttribute('data-name');
});

// Architecture System Class
class AISystem {
    constructor(name, numNodes, domPrefix) {
        this.name = name;
        this.numNodes = numNodes;
        this.domPrefix = domPrefix;
        
        this.queue = [];
        this.nodes = Array.from({length: numNodes}, (_, i) => ({ id: i+1, isBusy: false, timeUntilFree: 0, currentPatient: null }));
        
        this.errors = 0;
        this.failurePoint = null;
        
        this.windowDelays = [];
        this.windowResponses = [];
        this.patientsFinished = 0;
        this.totalReceived = 0;
        this.totalProcessed = 0;
        this.correctCount = 0;

        this.chartDataDelay = [];
        this.chartDataThroughput = [];
        this.chartDataUtil = [];
        this.chartDataResponse = [];

        // DOM
        this.mDelay = document.getElementById(`${domPrefix}-delay`);
        this.mThroughput = document.getElementById(`${domPrefix}-throughput`);
        this.mErrors = document.getElementById(`${domPrefix}-errors`);
        this.mAccuracy = document.getElementById(`${domPrefix}-accuracy`);
        this.elFailBox = document.getElementById(`fail-${domPrefix === 's' ? 'single' : 'dist'}`);
        this.elFailValue = this.elFailBox.querySelector('.fail-value');
    }

    addPatient(patient) {
        this.totalReceived++;
        if (this.queue.length >= MAX_QUEUE) {
            this.errors++;
            this.mErrors.innerText = this.errors;
            if (!this.failurePoint) {
                this.failurePoint = arrivalRate;
                this.elFailBox.classList.add('failed');
                const timeStr = (currentTime / 1000).toFixed(1);
                this.elFailValue.innerHTML = `${arrivalRate} pts/min (${aiModelName})<br>
                <span style="font-size: 0.9rem; font-weight: normal; color: #e2e8f0;">Waktu: ${timeStr}s | Total Pasien: ${this.totalReceived}</span>`;
            }
            return false;
        }
        this.queue.push(patient);
        return true;
    }

    tick(currentTime) {
        this.nodes.forEach(node => {
            if (node.isBusy) {
                node.timeUntilFree -= TICK_RATE;
                if (node.timeUntilFree <= 0) {
                    const responseTime = currentTime - node.currentPatient.arrivalTime;
                    this.windowResponses.push(responseTime);
                    this.patientsFinished++;
                    this.totalProcessed++;
                    if (node.currentPatient.isCorrect) {
                        this.correctCount++;
                    }
                    node.isBusy = false;
                    node.currentPatient = null;
                }
            }
            if (!node.isBusy && this.queue.length > 0) {
                const p = this.queue.shift();
                this.windowDelays.push(currentTime - p.arrivalTime);
                node.isBusy = true;
                node.currentPatient = p;
                
                // Processing speed variance +/- 20%
                const variance = processingSpeed * 0.2;
                node.timeUntilFree = processingSpeed + (Math.random() * variance * 2 - variance);
            }
        });
    }

    aggregate() {
        const avgDelayMs = this.windowDelays.length > 0 ? this.windowDelays.reduce((a,b)=>a+b,0) / this.windowDelays.length : 0;
        const avgResponseMs = this.windowResponses.length > 0 ? this.windowResponses.reduce((a,b)=>a+b,0) / this.windowResponses.length : 0;
        const throughput = this.patientsFinished * 60; // Scale to pts/min based on the 1-second window
        const busyNodes = this.nodes.filter(n => n.isBusy).length;
        const util = (busyNodes / this.numNodes) * 100;

        this.mDelay.innerText = (avgDelayMs / 1000).toFixed(2) + 's';
        this.mThroughput.innerText = throughput + ' pts/min';

        const accuracyPct = this.totalProcessed > 0 ? (this.correctCount / this.totalProcessed * 100).toFixed(1) : 100.0;
        if (this.mAccuracy) this.mAccuracy.innerText = accuracyPct + '%';

        this.chartDataThroughput.push(throughput);
        this.chartDataDelay.push(avgDelayMs / 1000);
        this.chartDataUtil.push(util);
        this.chartDataResponse.push(avgResponseMs / 1000);

        if (this.chartDataThroughput.length > 30) {
            this.chartDataThroughput.shift();
            this.chartDataDelay.shift();
            this.chartDataUtil.shift();
            this.chartDataResponse.shift();
        }

        this.windowDelays = [];
        this.windowResponses = [];
        this.patientsFinished = 0;
    }

    reset() {
        this.queue = [];
        this.nodes.forEach(n => { n.isBusy = false; n.timeUntilFree = 0; n.currentPatient = null; });
        this.errors = 0;
        this.totalReceived = 0;
        this.totalProcessed = 0;
        this.correctCount = 0;
        this.failurePoint = null;
        this.chartDataThroughput.length = 0;
        this.chartDataDelay.length = 0;
        this.chartDataUtil.length = 0;
        this.chartDataResponse.length = 0;
        this.mErrors.innerText = '0';
        this.mDelay.innerText = '0.00s';
        this.mThroughput.innerText = '0 pts/min';
        if (this.mAccuracy) this.mAccuracy.innerText = '100.0%';
        this.elFailBox.classList.remove('failed');
        this.elFailValue.innerText = 'Belum Gagal';
    }
}

const sysSingle = new AISystem('Single', 1, 's');
const sysDist = new AISystem('Distributed', 3, 'd');

// Chart Setup
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = 'Outfit';

function createDelayThroughputChart(ctxId, sys) {
    return new Chart(document.getElementById(ctxId).getContext('2d'), {
        type: 'line',
        data: {
            labels: Array(30).fill(''),
            datasets: [
                { label: 'Delay (s)', data: sys.chartDataDelay, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', yAxisID: 'y', fill: true, tension: 0.3 },
                { label: 'Throughput', data: sys.chartDataThroughput, borderColor: '#3b82f6', yAxisID: 'y1', tension: 0.3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
            scales: { y: { display: true, position: 'left' }, y1: { display: true, position: 'right', grid: { drawOnChartArea: false } } }
        }
    });
}

function createUtilResponseChart(ctxId, sys) {
    return new Chart(document.getElementById(ctxId).getContext('2d'), {
        type: 'scatter',
        data: { datasets: [{ label: 'Response vs Util', data: [], backgroundColor: '#a78bfa', borderColor: '#8b5cf6', pointRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
            scales: { x: { min: 0, max: 100, title: { display: true, text: 'Utilization %' } }, y: { title: { display: true, text: 'Response (s)' } } }
        }
    });
}

const chartSDelay = createDelayThroughputChart('chart-s-delay', sysSingle);
const chartSUtil = createUtilResponseChart('chart-s-util', sysSingle);
const chartDDelay = createDelayThroughputChart('chart-d-delay', sysDist);
const chartDUtil = createUtilResponseChart('chart-d-util', sysDist);

function updateCharts() {
    chartSDelay.update();
    chartDDelay.update();
    
    chartSUtil.data.datasets[0].data = sysSingle.chartDataUtil.map((u, i) => ({x: u, y: sysSingle.chartDataResponse[i]}));
    chartDUtil.data.datasets[0].data = sysDist.chartDataUtil.map((u, i) => ({x: u, y: sysDist.chartDataResponse[i]}));
    
    chartSUtil.update();
    chartDUtil.update();
}

// Data & Logging
const elPatientLogs = document.getElementById('patient-logs');
const modelAccuracyMap = {
    '150': 0.80, // Gemini
    '400': 0.85, // DeepSeek
    '600': 0.92, // GPT
    '1200': 0.98 // Claude
};

let currentTime = 0;
let generatorInterval, tickInterval, aggInterval;

function generatePatient() {
    if (!isRunning) return;
    
    const accuracy = modelAccuracyMap[elAiModel.value] || 0.90;
    const data = patientDataset[Math.floor(Math.random() * patientDataset.length)];
    const isCorrect = Math.random() < accuracy;
    
    let predictedCondition = data.kondisiAsli;
    let predictedPriority = data.prioritasAsli;
    
    if (!isCorrect) {
        let wrongData = data;
        while(wrongData.kondisiAsli === data.kondisiAsli) {
            wrongData = patientDataset[Math.floor(Math.random() * patientDataset.length)];
        }
        predictedCondition = wrongData.kondisiAsli;
        predictedPriority = wrongData.prioritasAsli;
    }

    const pTemplate = { 
        id: patientIdCounter++, 
        keluhan: data.keluhan,
        kondisiAsli: data.kondisiAsli,
        prioritasAsli: data.prioritasAsli,
        predictedCondition: predictedCondition,
        predictedPriority: predictedPriority,
        isCorrect: isCorrect,
        arrivalTime: currentTime 
    };
    
    // Send identical clones to both systems to ensure fair comparison
    const s1 = sysSingle.addPatient({...pTemplate});
    const s2 = sysDist.addPatient({...pTemplate});
    
    // Log
    while (elPatientLogs.children.length >= 10) elPatientLogs.removeChild(elPatientLogs.lastChild);
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>#${pTemplate.id}</td>
        <td style="font-size: 0.85rem; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${pTemplate.keluhan}">${pTemplate.keluhan}</td>
        <td>${pTemplate.kondisiAsli} <br><small>Level ${pTemplate.prioritasAsli}</small></td>
        <td>${pTemplate.predictedCondition} <br><small class="priority-${pTemplate.predictedPriority}">Level ${pTemplate.predictedPriority}</small></td>
        <td class="${pTemplate.isCorrect ? 'status-success' : 'status-error'}">${pTemplate.isCorrect ? 'Tepat' : 'Meleset'}</td>
        <td class="${s1 ? 'status-success' : 'status-error'}">${s1 ? 'Queued' : 'Dropped'}</td>
        <td class="${s2 ? 'status-success' : 'status-error'}">${s2 ? 'Queued' : 'Dropped'}</td>
    `;
    elPatientLogs.insertBefore(tr, elPatientLogs.firstChild);

    // Calculate timeout based on patients per minute
    setTimeout(generatePatient, 60000 / arrivalRate);
}

function simulationTick() {
    if (!isRunning) return;
    currentTime += TICK_RATE;
    sysSingle.tick(currentTime);
    sysDist.tick(currentTime);
    
    if (currentTime >= 60000) {
        btnStop.click(); // Auto-stop at 1 minute
        showResultsModal();
    }
}

function aggregateData() {
    if (!isRunning) return;
    sysSingle.aggregate();
    sysDist.aggregate();
    updateCharts();
    
    const timeLeft = Math.max(0, 60 - Math.floor(currentTime / 1000));
    const elTimer = document.getElementById('sim-timer');
    if (elTimer) {
        elTimer.innerText = `00:${timeLeft.toString().padStart(2, '0')}`;
    }
}

btnStart.addEventListener('click', () => {
    isRunning = true;
    btnStart.disabled = true;
    btnStop.disabled = false;
    
    generatePatient();
    tickInterval = setInterval(simulationTick, TICK_RATE);
    aggInterval = setInterval(aggregateData, 1000);
});

btnStop.addEventListener('click', () => {
    isRunning = false;
    btnStart.disabled = false;
    btnStop.disabled = true;
    clearInterval(tickInterval);
    clearInterval(aggInterval);
});

btnReset.addEventListener('click', () => {
    sysSingle.reset();
    sysDist.reset();
    currentTime = 0;
    patientIdCounter = 1;
    updateCharts();
    elPatientLogs.innerHTML = '';
    
    const elTimer = document.getElementById('sim-timer');
    if (elTimer) elTimer.innerText = '01:00';
});

function getSystemStatusText(sys) {
    if (sys.failurePoint || sys.errors > 0) {
        return `<strong style="color: #ef4444;">Sistem Gagal (Overload)</strong><br>
                <span style="font-size: 0.85rem; color: #cbd5e1;">Kecepatan AI model (${processingSpeed}ms) tidak cukup untuk menangani laju ${arrivalRate} pasien/menit dengan jumlah node ${sys.numNodes}. Antrean menumpuk hingga batas maksimal dan pasien mulai ditolak (dropped).</span>`;
    } else {
        return `<strong style="color: #22c55e;">Sistem Stabil</strong><br>
                <span style="font-size: 0.85rem; color: #cbd5e1;">Kapasitas sistem (${sys.numNodes} node, ${processingSpeed}ms/pasien) memadai untuk mengimbangi laju ${arrivalRate} pasien/menit. Throughput tinggi, utilisasi optimal, dan antrean tidak penuh.</span>`;
    }
}

function showResultsModal() {
    const sUnhandled = sysSingle.errors + sysSingle.queue.length;
    const dUnhandled = sysDist.errors + sysDist.queue.length;
    
    document.getElementById('m-s-handled').innerText = sysSingle.totalProcessed;
    document.getElementById('m-s-acc').innerText = sysSingle.mAccuracy ? sysSingle.mAccuracy.innerText : '0%';
    document.getElementById('m-s-unhandled').innerText = sUnhandled;
    document.getElementById('m-s-status').innerHTML = getSystemStatusText(sysSingle);
    
    document.getElementById('m-d-handled').innerText = sysDist.totalProcessed;
    document.getElementById('m-d-acc').innerText = sysDist.mAccuracy ? sysDist.mAccuracy.innerText : '0%';
    document.getElementById('m-d-unhandled').innerText = dUnhandled;
    document.getElementById('m-d-status').innerHTML = getSystemStatusText(sysDist);
    
    document.getElementById('result-modal').style.display = 'flex';
}

document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('result-modal').style.display = 'none';
});

// --- AUTO BENCHMARK LOGIC ---
const btnAutoSim = document.getElementById('btn-auto-sim');
if (btnAutoSim) {
    btnAutoSim.addEventListener('click', runAutomatedBenchmark);
}

function runAutomatedBenchmark() {
    const section = document.getElementById('benchmark-section');
    const container = document.getElementById('benchmark-results');
    section.style.display = 'block';
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Menjalankan simulasi paralel, mohon tunggu...</p>';

    // Gunakan setTimeout agar UI sempat merender status "Running"
    setTimeout(() => {
        const scenarios = [
            { name: 'Normal', rate: 60 },
            { name: 'Stress', rate: 240 },
            { name: 'Extreme', rate: 600 }
        ];

        const models = [
            { name: 'Gemini 1.5 Flash', speed: 150, acc: 0.80 },
            { name: 'DeepSeek V2', speed: 400, acc: 0.85 },
            { name: 'GPT-4o', speed: 600, acc: 0.92 },
            { name: 'Claude 3 Opus', speed: 1200, acc: 0.98 }
        ];

        const DURATION_MS = 60000;
        const TICK_RATE = 50;
        let html = '<table class="benchmark-table"><thead><tr><th>Model / Speed</th><th>Avg Delay</th><th>Throughput</th><th>Accuracy</th><th>Dropped</th><th>Status</th></tr></thead><tbody>';

        scenarios.forEach(scen => {
            html += `<tr class="scenario-row"><th colspan="6">Scenario: ${scen.name} (${scen.rate} pasien/menit)</th></tr>`;
            
            models.forEach(mod => {
                // Menggunakan 3 node sesuai arsitektur Distributed
                let system = new HeadlessAISystem(mod.name, 3, mod.speed);
                let currentTime = 0;
                let nextPatientTime = 0;
                let patientInterval = 60000 / scen.rate;
                let idCounter = 1;

                while (currentTime < DURATION_MS) {
                    while (currentTime >= nextPatientTime) {
                        const isCorrect = Math.random() < mod.acc;
                        system.addPatient({ id: idCounter++, arrivalTime: currentTime, isCorrect: isCorrect });
                        nextPatientTime += patientInterval;
                    }
                    system.tick(currentTime, TICK_RATE);
                    currentTime += TICK_RATE;
                }

                const metrics = system.getMetrics();
                
                // Evaluasi Kriteria
                let failCount = 0;
                let isDelayPass = metrics.avgDelaySec < 5;
                let isAccPass = metrics.accuracy > 90;
                let isDropPass = metrics.dropPct < 5;

                if (!isDelayPass) failCount++;
                if (!isAccPass) failCount++;
                if (!isDropPass) failCount++;

                let statusClass = 'status-stable';
                let statusText = 'Stable';
                if (failCount === 1) {
                    statusClass = 'status-degraded';
                    statusText = 'Degraded';
                } else if (failCount >= 2) {
                    statusClass = 'status-failed';
                    statusText = 'Failed';
                }

                html += `<tr>
                    <td><strong>${mod.name}</strong><br><small style="color:var(--text-secondary);">${mod.speed}ms</small></td>
                    <td class="${isDelayPass ? 'metric-pass' : 'metric-fail'}">${metrics.avgDelaySec.toFixed(2)}s</td>
                    <td>${metrics.throughput} pts/min</td>
                    <td class="${isAccPass ? 'metric-pass' : 'metric-fail'}">${metrics.accuracy.toFixed(1)}%</td>
                    <td class="${isDropPass ? 'metric-pass' : 'metric-fail'}">${metrics.totalDropped} (${metrics.dropPct.toFixed(1)}%)</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                </tr>`;
            });
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }, 100);
}

class HeadlessAISystem {
    constructor(name, numNodes, speed) {
        this.name = name;
        this.numNodes = numNodes;
        this.processingSpeed = speed;
        this.queue = [];
        this.nodes = Array.from({length: numNodes}, (_, i) => ({ id: i+1, isBusy: false, timeUntilFree: 0, currentPatient: null }));
        this.errors = 0;
        this.windowDelays = [];
        this.patientsFinished = 0;
        this.totalReceived = 0;
        this.totalProcessed = 0;
        this.correctCount = 0;
    }

    addPatient(patient) {
        this.totalReceived++;
        if (this.queue.length >= 50) { // MAX_QUEUE = 50
            this.errors++;
            return false;
        }
        this.queue.push(patient);
        return true;
    }

    tick(currentTime, tickRate) {
        this.nodes.forEach(node => {
            if (node.isBusy) {
                node.timeUntilFree -= tickRate;
                if (node.timeUntilFree <= 0) {
                    this.patientsFinished++;
                    this.totalProcessed++;
                    if (node.currentPatient.isCorrect) {
                        this.correctCount++;
                    }
                    node.isBusy = false;
                    node.currentPatient = null;
                }
            }
            if (!node.isBusy && this.queue.length > 0) {
                const p = this.queue.shift();
                this.windowDelays.push(currentTime - p.arrivalTime);
                node.isBusy = true;
                node.currentPatient = p;
                
                const variance = this.processingSpeed * 0.2;
                node.timeUntilFree = this.processingSpeed + (Math.random() * variance * 2 - variance);
            }
        });
    }

    getMetrics() {
        const avgDelayMs = this.windowDelays.length > 0 ? this.windowDelays.reduce((a,b)=>a+b,0) / this.windowDelays.length : 0;
        const throughput = this.patientsFinished; 
        const accuracyPct = this.totalProcessed > 0 ? (this.correctCount / this.totalProcessed * 100) : 100.0;
        const dropPct = this.totalReceived > 0 ? (this.errors / this.totalReceived * 100) : 0;
        
        return {
            avgDelaySec: avgDelayMs / 1000,
            throughput: throughput,
            accuracy: accuracyPct,
            dropPct: dropPct,
            totalDropped: this.errors
        };
    }
}
