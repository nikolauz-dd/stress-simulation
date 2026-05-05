// ============================================================
// FIGURES.JS — Chart initialization & update for all 12 figures
// ============================================================

Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = 'Outfit, sans-serif';
Chart.defaults.font.size = 11;

const CHARTS = {};

function makeChart(id, config) {
    if (CHARTS[id]) CHARTS[id].destroy();
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    CHARTS[id] = new Chart(ctx.getContext('2d'), config);
    return CHARTS[id];
}

function archDataset(arch, label, data, opts = {}) {
    return { label, data, borderColor: arch.color, backgroundColor: arch.colorAlpha,
             borderWidth: 2, pointRadius: 0, fill: opts.fill || false, tension: 0.35, ...opts };
}

function commonScales(yText) {
    return {
        x: { title: { display: true, text: 'Time (min)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { title: { display: true, text: yText, font: { size: 10 } }, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } }
    };
}
const commonOpts = { responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 10 } } } };

// ---- Fig 3: Waiting Time Over Time ----
function initFig3() {
    makeChart('fig3', { type: 'line', data: { labels: [], datasets: [] },
        options: { ...commonOpts, scales: commonScales('Avg Wait (min)') } });
}
function updateFig3(results) {
    const ch = CHARTS['fig3']; if (!ch) return;
    const labels = results[0].timeSeries.map(d => d.min);
    ch.data.labels = labels;
    ch.data.datasets = results.map(r => {
        const a = ARCHITECTURES.find(x => x.id === r.archId);
        return archDataset(a, a.shortName, r.timeSeries.map(d => d.avgWaitMin));
    });
    ch.data.datasets.push({ label: 'Threshold', data: labels.map(() => SimState.thresholds.maxAvgWaitMin),
        borderColor: '#ef4444', borderDash: [5,4], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0 });
    ch.update();
}

// ---- Fig 4: Queue Length Over Time ----
function initFig4() {
    makeChart('fig4', { type: 'line', data: { labels: [], datasets: [] },
        options: { ...commonOpts, scales: commonScales('Queue Length') } });
}
function updateFig4(results) {
    const ch = CHARTS['fig4']; if (!ch) return;
    const labels = results[0].timeSeries.map(d => d.min);
    ch.data.labels = labels; ch.data.datasets = [];
    results.forEach(r => {
        const a = ARCHITECTURES.find(x => x.id === r.archId);
        ch.data.datasets.push(archDataset(a, `${a.shortName} Total`, r.timeSeries.map(d => d.qTotal)));
        ch.data.datasets.push({ label: `${a.shortName} Critical`, data: r.timeSeries.map(d => d.qCrit),
            borderColor: a.color, borderDash: [4,3], borderWidth: 1.5,
            backgroundColor: 'transparent', pointRadius: 0, tension: 0.35 });
    });
    ch.update();
}

// ---- Fig 5: Critical-Case Delay (Bar) ----
function initFig5() {
    makeChart('fig5', { type: 'bar', data: { labels: [], datasets: [] },
        options: { ...commonOpts, scales: {
            x: { grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { beginAtZero: true, title: { display: true, text: 'Critical Delay (min)', font: { size: 10 } },
                 grid: { color: 'rgba(255,255,255,0.06)' } } } } });
}
function updateFig5(results) {
    const ch = CHARTS['fig5']; if (!ch) return;
    const thr = SimState.thresholds.maxCriticalDelayMin;
    ch.data.labels = results.map(r => ARCHITECTURES.find(a => a.id === r.archId).shortName);
    ch.data.datasets = [
        { label: 'Critical Delay (min)', data: results.map(r => +r.summary.criticalDelayMin.toFixed(2)),
          backgroundColor: results.map(r => r.summary.criticalDelayMin > thr ? 'rgba(239,68,68,0.7)' :
              r.summary.criticalDelayMin > thr * 0.7 ? 'rgba(249,115,22,0.7)' : 'rgba(16,185,129,0.7)'),
          borderColor: 'transparent', borderRadius: 6 },
        { label: `Threshold (${thr} min)`, data: results.map(() => thr), type: 'line',
          borderColor: '#ef4444', borderDash: [5,4], borderWidth: 1.5, pointRadius: 0, fill: false }
    ];
    ch.update();
}

// ---- Fig 6: Escalation Success Rate ----
function initFig6() {
    makeChart('fig6', { type: 'line', data: { labels: [], datasets: [] },
        options: { ...commonOpts, scales: {
            x: { title: { display: true, text: 'Time (min)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { min: 50, max: 100, title: { display: true, text: 'Escalation Success (%)', font: { size: 10 } },
                 grid: { color: 'rgba(255,255,255,0.06)' } } } } });
}
function updateFig6(results) {
    const ch = CHARTS['fig6']; if (!ch) return;
    const labels = results[0].timeSeries.map(d => d.min);
    ch.data.labels = labels;
    ch.data.datasets = results.map(r => {
        const a = ARCHITECTURES.find(x => x.id === r.archId);
        return archDataset(a, a.shortName, r.timeSeries.map(d => d.escalSucc));
    });
    ch.data.datasets.push({ label: `Min (${SimState.thresholds.minEscalationSuccess}%)`,
        data: labels.map(() => SimState.thresholds.minEscalationSuccess),
        borderColor: '#ef4444', borderDash: [5,4], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0 });
    ch.update();
}

// ---- Fig 7: Clinician Utilization ----
function initFig7() {
    makeChart('fig7', { type: 'line', data: { labels: [], datasets: [] },
        options: { ...commonOpts, scales: {
            x: { title: { display: true, text: 'Time (min)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { min: 0, max: 100, title: { display: true, text: 'Utilization (%)', font: { size: 10 } },
                 grid: { color: 'rgba(255,255,255,0.06)' } } } } });
}
function updateFig7(results) {
    const ch = CHARTS['fig7']; if (!ch) return;
    const labels = results[0].timeSeries.map(d => d.min);
    ch.data.labels = labels;
    ch.data.datasets = results.map(r => {
        const a = ARCHITECTURES.find(x => x.id === r.archId);
        return archDataset(a, a.shortName, r.timeSeries.map(d => d.clinUtil), { fill: true });
    });
    ch.data.datasets.push(
        { label: 'Overload (85%)', data: labels.map(() => 85), borderColor: '#f59e0b',
          borderDash: [5,4], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0 },
        { label: 'Critical (90%)', data: labels.map(() => 90), borderColor: '#ef4444',
          borderDash: [3,3], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0 }
    );
    ch.update();
}

// ---- Fig 8: Failure Boundary Heatmap (Custom Canvas) ----
function renderFig8(boundaryData, archId) {
    const canvas = document.getElementById('fig8-' + archId);
    if (!canvas || !boundaryData) return;
    const { arrivalRates, clinCounts, grid } = boundaryData;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cellW = W / arrivalRates.length, cellH = (H - 20) / clinCounts.length;
    const zCol = { green: '#10b981', yellow: '#eab308', orange: '#f97316', red: '#ef4444' };
    ctx.clearRect(0, 0, W, H);
    grid.forEach(cell => {
        const xi = arrivalRates.indexOf(cell.arrivalRate);
        const yi = clinCounts.indexOf(cell.clinicians);
        const x = xi * cellW, y = (clinCounts.length - 1 - yi) * cellH;
        ctx.fillStyle = zCol[cell.zone] + 'cc';
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = 'bold 8px Outfit,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cell.zone[0].toUpperCase(), x + cellW / 2, y + cellH / 2 + 3);
    });
    ctx.fillStyle = '#64748b'; ctx.font = '8px Outfit,sans-serif';
    arrivalRates.forEach((r, i) => { ctx.textAlign = 'center'; ctx.fillText(r, i * cellW + cellW / 2, H - 4); });
}

// ---- Fig 9: Architecture Comparison Radar ----
function initFig9() {
    makeChart('fig9', { type: 'radar',
        data: { labels: ['Delay Score', 'Escalation', 'Drop Safety', 'Clin. Eff.', 'Resilience', 'Safety'], datasets: [] },
        options: { ...commonOpts, scales: { r: { min: 0, max: 100,
            grid: { color: 'rgba(255,255,255,0.08)' },
            pointLabels: { font: { size: 10 }, color: '#cbd5e1' }, ticks: { display: false } } } } });
}
function updateFig9(results) {
    const ch = CHARTS['fig9']; if (!ch) return;
    ch.data.datasets = results.map(r => {
        const a = ARCHITECTURES.find(x => x.id === r.archId), s = r.summary;
        return { label: a.shortName, borderColor: a.color, backgroundColor: a.colorAlpha, borderWidth: 2,
            pointBackgroundColor: a.color,
            data: [Math.max(0, 100 - s.avgWaitMin * 10), s.escalationSuccess,
                   Math.max(0, 100 - s.dropRate * 5), Math.max(0, 100 - Math.abs(s.clinicianUtil - 70) * 2),
                   s.resilienceScore, s.safetyScore] };
    });
    ch.update();
}

// ---- Fig 10: Monte Carlo Fan Chart ----
function initFig10() {
    makeChart('fig10', { type: 'line', data: { labels: [], datasets: [] },
        options: { ...commonOpts, scales: commonScales('Avg Wait (min) — P10/P50/P90') } });
}
function updateFig10(mcResults, archId) {
    const ch = CHARTS['fig10']; if (!ch || !mcResults) return;
    const mc = mcResults[archId]; if (!mc) return;
    const a = ARCHITECTURES.find(x => x.id === archId);
    const labels = mc.bands.map(b => b.min);
    ch.data.labels = labels;
    ch.data.datasets = [
        { label: `P90`, data: mc.bands.map(b => +b.avgWaitMin.p90.toFixed(3)), borderColor: a.color + '66',
          borderWidth: 1, fill: '+1', backgroundColor: a.color + '22', pointRadius: 0, tension: 0.35 },
        { label: `P50 (${a.shortName})`, data: mc.bands.map(b => +b.avgWaitMin.p50.toFixed(3)),
          borderColor: a.color, borderWidth: 2.5, fill: false, pointRadius: 0, tension: 0.35 },
        { label: `P10`, data: mc.bands.map(b => +b.avgWaitMin.p10.toFixed(3)), borderColor: a.color + '66',
          borderWidth: 1, fill: '-1', backgroundColor: a.color + '22', pointRadius: 0, tension: 0.35 }
    ];
    ch.update();
}

// ---- Fig 11: Trade-off Scatter ----
function initFig11() {
    makeChart('fig11', { type: 'scatter', data: { datasets: [] },
        options: { ...commonOpts, scales: {
            x: { title: { display: true, text: 'Speed Score', font: { size: 10 } }, min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { title: { display: true, text: 'Safety Score', font: { size: 10 } }, min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.06)' } } } } });
}
function updateFig11(results) {
    const ch = CHARTS['fig11']; if (!ch) return;
    ch.data.datasets = results.map(r => {
        const a = ARCHITECTURES.find(x => x.id === r.archId), s = r.summary;
        return { label: a.shortName, data: [{ x: s.speedScore, y: s.safetyScore }],
                 backgroundColor: a.color, pointRadius: 14, pointHoverRadius: 17 };
    });
    ch.update();
}

// ---- Init & Update All ----
function initAllFigures() {
    [initFig3, initFig4, initFig5, initFig6, initFig7, initFig9, initFig10, initFig11].forEach(f => f());
}

function updateAllFigures(results, mcResults, boundaryMaps) {
    if (!results || !results.length) return;
    updateFig3(results); updateFig4(results); updateFig5(results); updateFig6(results);
    updateFig7(results); updateFig9(results); updateFig11(results);
    if (mcResults) {
        const firstId = Object.keys(mcResults)[0];
        updateFig10(mcResults, firstId);
        const sel = document.getElementById('mc-arch-sel');
        if (sel) { sel.innerHTML = Object.keys(mcResults).map(id => {
            const a = ARCHITECTURES.find(x => x.id === id);
            return `<option value="${id}">${a.shortName}</option>`;
        }).join(''); sel.onchange = () => updateFig10(mcResults, sel.value); }
    }
    if (boundaryMaps) {
        Object.entries(boundaryMaps).forEach(([aid, data]) => renderFig8(data, aid));
    }
}
