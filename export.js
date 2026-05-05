// ============================================================
// EXPORT.JS — Export figures and data for Q1 paper
// ============================================================

// ---- Download helper ----
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ---- Export individual Chart.js canvas as PNG ----
function exportChartPNG(chartId, filename) {
    const canvas = document.getElementById(chartId);
    if (!canvas) { alert('Chart not found: ' + chartId); return; }
    // Render at 3x for ~300dpi equivalent
    const scale = 3;
    const offscreen = document.createElement('canvas');
    offscreen.width  = canvas.width  * scale;
    offscreen.height = canvas.height * scale;
    const ctx = offscreen.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0, 0);
    offscreen.toBlob(blob => downloadBlob(blob, filename + '.png'), 'image/png');
}

// ---- Export Chart.js canvas as SVG (via canvg approximation) ----
// Since full SVG export requires server, we export PNG with note
function exportChartSVG(chartId, filename) {
    // For browser-only, export as high-res PNG with SVG label
    exportChartPNG(chartId, filename + '_hires');
}

// ---- Export all figures as PNG bundle ----
function exportAllFiguresPNG() {
    const figIds = ['fig3','fig4','fig5','fig6','fig7','fig9','fig10','fig11'];
    const figNames = ['Fig3_WaitingTime','Fig4_QueueLength','Fig5_CriticalDelay',
                      'Fig6_EscalationSuccess','Fig7_ClinicianUtil','Fig9_ArchComparison',
                      'Fig10_MonteCarlo','Fig11_TradeoffMap'];
    figIds.forEach((id, i) => {
        setTimeout(() => exportChartPNG(id, figNames[i]), i * 300);
    });
    // Also export boundary canvases
    ARCHITECTURES.forEach((a, i) => {
        setTimeout(() => {
            const canvas = document.getElementById('fig8-' + a.id);
            if (!canvas) return;
            canvas.toBlob(blob => downloadBlob(blob, `Fig8_Boundary_${a.shortName}.png`), 'image/png');
        }, (figIds.length + i) * 300);
    });
}

// ---- Export simulation results as CSV ----
function exportCSV() {
    if (!SimState.results) { alert('Run simulation first.'); return; }
    const rows = [['Architecture','Scenario','Minute','AvgWait_min','CriticalDelay_min',
        'QueueTotal','QueueCritical','QueueClinician','EscalationSuccess_pct',
        'DropRate_pct','ClinicianUtil_pct','AIConfidence_pct','SafetyScore']];
    SimState.results.forEach(r => {
        r.timeSeries.forEach(ts => {
            rows.push([r.archName, SimState.selectedScenario, ts.min,
                ts.avgWaitMin, ts.criticalDelMin ?? ts.critDelMin ?? '',
                ts.qTotal, ts.qCrit, ts.qClin,
                ts.escalSucc, ts.dropRate, ts.clinUtil, ts.aiConf, ts.safetyScore]);
        });
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `simulation_results_${Date.now()}.csv`);
}

// ---- Export simulation summary as JSON ----
function exportJSON() {
    if (!SimState.results) { alert('Run simulation first.'); return; }
    const output = {
        metadata: buildReproducibilityRecord(),
        thresholds: SimState.thresholds,
        summaries: SimState.results.map(r => ({
            architecture: r.archName,
            scenario: r.scenarioId,
            summary: r.summary,
            timeToZone: r.timeToZone,
            finalZone: r.summary.finalZone
        }))
    };
    downloadBlob(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }),
        `sim_params_${Date.now()}.json`);
}

// ---- Export simulation event log as text ----
function exportSimLog() {
    if (!SimState.results) { alert('Run simulation first.'); return; }
    let log = `SIMULATION LOG\n${'='.repeat(60)}\n`;
    log += `Date: ${new Date().toISOString()}\n`;
    log += `Scenario: ${SimState.selectedScenario}\n`;
    log += `Duration: ${SimState.params.durationMin} minutes\n`;
    log += `Seed: ${SimState.params.seed}\n`;
    log += `Monte Carlo Runs: ${SimState.params.mcRuns}\n\n`;
    SimState.results.forEach(r => {
        log += `\n${'─'.repeat(40)}\n`;
        log += `Architecture: ${r.archName}\n`;
        log += `Final Zone: ${r.summary.finalZone.toUpperCase()}\n`;
        log += `Avg Wait: ${r.summary.avgWaitMin.toFixed(2)} min\n`;
        log += `Critical Delay: ${r.summary.criticalDelayMin.toFixed(2)} min\n`;
        log += `Escalation Success: ${r.summary.escalationSuccess.toFixed(1)}%\n`;
        log += `Drop Rate: ${r.summary.dropRate.toFixed(1)}%\n`;
        log += `Clinician Util: ${r.summary.clinicianUtil.toFixed(1)}%\n`;
        log += `Safety Score: ${r.summary.safetyScore.toFixed(1)}\n`;
        log += `Resilience Score: ${r.summary.resilienceScore.toFixed(1)}\n`;
        if (r.timeToZone.yellow) log += `Time to Yellow: ${r.timeToZone.yellow} min\n`;
        if (r.timeToZone.orange) log += `Time to Orange: ${r.timeToZone.orange} min\n`;
        if (r.timeToZone.red)    log += `Time to Red: ${r.timeToZone.red} min\n`;
    });
    downloadBlob(new Blob([log], { type: 'text/plain' }), `sim_log_${Date.now()}.txt`);
}

// ---- Build reproducibility record ----
function buildReproducibilityRecord() {
    return {
        timestamp: new Date().toISOString(),
        modelVersion: '2.0.0-Q1DES',
        scenario: SimState.selectedScenario,
        architectures: SimState.selectedArchIds,
        durationMin: SimState.params.durationMin,
        seed: SimState.params.seed,
        mcRuns: SimState.params.mcRuns,
        severityMix: SimState.params.severityMix,
        thresholds: SimState.thresholds
    };
}

// ---- Render reproducibility panel ----
function renderReproPanel() {
    const el = document.getElementById('repro-content');
    if (!el) return;
    const rec = buildReproducibilityRecord();
    el.innerHTML = `<pre>${JSON.stringify(rec, null, 2)}</pre>`;
}
