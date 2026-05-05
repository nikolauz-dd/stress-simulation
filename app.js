// ============================================================
// APP.JS — Main controller: wires UI, runs simulation, updates dashboard
// ============================================================

// ---- Build scenario buttons ----
function buildScenarioButtons() {
    const el = document.getElementById('scenario-btns');
    SCENARIOS.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'scenario-btn' + (s.id === SimState.selectedScenario ? ' active' : '');
        btn.textContent = s.name;
        btn.title = s.description;
        btn.onclick = () => {
            document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            SimState.selectedScenario = s.id;
        };
        el.appendChild(btn);
    });
}

// ---- Build architecture toggles ----
function buildArchToggles() {
    const el = document.getElementById('arch-toggles');
    ARCHITECTURES.forEach(a => {
        const btn = document.createElement('button');
        btn.className = 'arch-toggle' + (SimState.selectedArchIds.includes(a.id) ? ' active' : '');
        btn.textContent = a.shortName;
        btn.style.setProperty('--color', a.color);
        btn.title = a.description;
        btn.onclick = () => {
            if (SimState.selectedArchIds.includes(a.id)) {
                if (SimState.selectedArchIds.length === 1) return; // keep ≥1
                SimState.selectedArchIds = SimState.selectedArchIds.filter(x => x !== a.id);
                btn.classList.remove('active');
            } else {
                SimState.selectedArchIds.push(a.id);
                btn.classList.add('active');
            }
        };
        el.appendChild(btn);
    });
}

// ---- Build architecture SVG diagrams ----
function buildArchDiagrams() {
    const el = document.getElementById('arch-diagrams');
    ARCHITECTURES.forEach(a => {
        const div = document.createElement('div');
        div.className = 'glass arch-diagram-card';
        div.style.borderTop = `3px solid ${a.color}`;
        const rm = 1.0;
        div.innerHTML = `
          <h4 style="color:${a.color}">${a.name}</h4>
          <svg class="arch-svg" viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg">
            <defs><marker id="ar-${a.id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#475569"/></marker></defs>
            <g font-family="Outfit,sans-serif" font-size="8" fill="#e2e8f0">
              <!-- Patients box -->
              <rect x="5" y="60" width="40" height="28" rx="4" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" stroke-width="1"/>
              <text x="25" y="76" text-anchor="middle" fill="#60a5fa" font-weight="700">Patients</text>
              <!-- AI Nodes -->
              ${Array.from({length: a.aiNodes}).map((_, i) => {
                  const y = 20 + i * 32;
                  return `<rect x="60" y="${y}" width="40" height="24" rx="4" fill="rgba(6,182,212,0.15)" stroke="#06b6d4" stroke-width="1"/>
                          <text x="80" y="${y+14}" text-anchor="middle" fill="#22d3ee" font-weight="700">AI${i+1}</text>`;
              }).join('')}
              <!-- Queue -->
              <rect x="115" y="60" width="35" height="28" rx="4" fill="rgba(234,179,8,0.15)" stroke="#eab308" stroke-width="1"/>
              <text x="132" y="76" text-anchor="middle" fill="#fde047" font-weight="700">Queue</text>
              <!-- Clinicians -->
              ${Array.from({length: Math.min(a.clinicians, 4)}).map((_, i) => {
                  const y = 10 + i * 32;
                  return `<rect x="165" y="${y}" width="45" height="24" rx="4" fill="rgba(16,185,129,0.15)" stroke="#10b981" stroke-width="1"/>
                          <text x="187" y="${y+14}" text-anchor="middle" fill="#34d399" font-weight="700">MD ${i+1}</text>`;
              }).join('')}
              <!-- Arrows -->
              <line x1="45" y1="74" x2="58" y2="74" stroke="#475569" stroke-width="1" marker-end="url(#ar-${a.id})"/>
              <line x1="100" y1="74" x2="113" y2="74" stroke="#475569" stroke-width="1" marker-end="url(#ar-${a.id})"/>
              <line x1="150" y1="74" x2="163" y2="50" stroke="#475569" stroke-width="1" marker-end="url(#ar-${a.id})"/>
              <!-- Labels -->
              <text x="110" y="148" text-anchor="middle" fill="#475569" font-size="7">
                AI: ${a.aiNodes} node(s) · Clinicians: ${a.clinicians} · Cap: ${a.queueCap}
              </text>
            </g>
          </svg>
          <p style="font-size:0.7rem;color:var(--muted);margin-top:0.5rem;text-align:center">${a.description}</p>
        `;
        el.appendChild(div);
    });
}

// ---- Severity mix sliders ----
function bindSeveritySliders() {
    const ids = ['sv-low', 'sv-med', 'sv-high', 'sv-crit'];
    const keys = ['low', 'medium', 'high', 'critical'];
    const normalize = () => {
        const vals = ids.map(id => +document.getElementById(id).value);
        const sum = vals.reduce((a, b) => a + b, 0) || 1;
        keys.forEach((k, i) => {
            SimState.params.severityMix[k] = vals[i] / sum;
            document.getElementById(ids[i] + '-val').textContent = Math.round(vals[i] / sum * 100) + '%';
        });
    };
    ids.forEach(id => document.getElementById(id).addEventListener('input', normalize));
    normalize();
}

// ---- Collect params from UI ----
function collectParams() {
    SimState.params.durationMin = +document.getElementById('p-duration').value || 30;
    SimState.params.seed        = +document.getElementById('p-seed').value || 42;
    SimState.params.mcRuns      = +document.getElementById('p-mcruns').value || 20;
    SimState.thresholds.maxAvgWaitMin       = +document.getElementById('thr-wait').value  || 5;
    SimState.thresholds.maxCriticalDelayMin = +document.getElementById('thr-crit').value  || 10;
    SimState.thresholds.minEscalationSuccess= +document.getElementById('thr-escal').value || 95;
    SimState.thresholds.maxDropRate         = +document.getElementById('thr-drop').value  || 5;
    SimState.thresholds.maxClinicianUtil    = +document.getElementById('thr-util').value  || 85;
}

// ---- Update zone badge ----
function updateZoneBadge(zone) {
    const el = document.getElementById('zone-badge');
    const labels = { green: '● GREEN — Safe', yellow: '⚠ YELLOW — Stressed',
                     orange: '▲ ORANGE — Near Failure', red: '✖ RED — Failure' };
    el.className = `zone-badge zone-${zone}`;
    el.textContent = labels[zone];
}

// ---- Update KPI cards ----
function updateKPIs(results) {
    // Use best-performing arch for overview (lowest avg wait)
    const best = results.reduce((a, b) => a.summary.avgWaitMin < b.summary.avgWaitMin ? a : b);
    const s = best.summary;
    const setKPI = (id, val, unit, warn, danger) => {
        const el = document.getElementById(id);
        el.textContent = val + unit;
        el.className = 'kpi-value' + (val >= danger ? ' danger' : val >= warn ? ' warn' : ' good');
    };
    document.getElementById('kpi-wait').textContent   = s.avgWaitMin.toFixed(1) + ' min';
    document.getElementById('kpi-crit').textContent   = s.criticalDelayMin.toFixed(1) + ' min';
    document.getElementById('kpi-escal').textContent  = s.escalationSuccess.toFixed(1) + '%';
    document.getElementById('kpi-drop').textContent   = s.dropRate.toFixed(1) + '%';
    document.getElementById('kpi-util').textContent   = s.clinicianUtil.toFixed(1) + '%';
    document.getElementById('kpi-safety').textContent = s.safetyScore.toFixed(0);

    const thr = SimState.thresholds;
    document.getElementById('kpi-wait').className  = 'kpi-value' + (s.avgWaitMin > thr.maxAvgWaitMin ? ' danger' : ' good');
    document.getElementById('kpi-crit').className  = 'kpi-value' + (s.criticalDelayMin > thr.maxCriticalDelayMin ? ' danger' : ' good');
    document.getElementById('kpi-escal').className = 'kpi-value' + (s.escalationSuccess < thr.minEscalationSuccess ? ' danger' : ' good');
    document.getElementById('kpi-drop').className  = 'kpi-value' + (s.dropRate > thr.maxDropRate ? ' danger' : ' good');
    document.getElementById('kpi-util').className  = 'kpi-value' + (s.clinicianUtil > 90 ? ' danger' : s.clinicianUtil > thr.maxClinicianUtil ? ' warn' : ' good');
    document.getElementById('kpi-safety').className= 'kpi-value' + (s.safetyScore < 70 ? ' danger' : s.safetyScore < 85 ? ' warn' : ' good');
}

// ---- Update time-to-failure display ----
function updateTTF(results) {
    // Use worst result (latest to fail = most resilient, earliest = weakest)
    const allTTF = results.map(r => r.timeToZone);
    const minVal = (key) => {
        const vals = allTTF.map(t => t[key]).filter(v => v != null);
        return vals.length ? Math.min(...vals) : null;
    };
    const y = minVal('yellow'), o = minVal('orange'), r = minVal('red');
    document.getElementById('ttf-yellow').textContent = y ? y + ' min' : '—';
    document.getElementById('ttf-orange').textContent = o ? o + ' min' : '—';
    document.getElementById('ttf-red').textContent    = r ? r + ' min' : '—';
}

// ---- Build failure boundary canvases ----
function buildBoundaryCanvases(archIds) {
    const grid = document.getElementById('fig8-grid');
    grid.innerHTML = '';
    archIds.forEach(id => {
        const a = ARCHITECTURES.find(x => x.id === id);
        const wrap = document.createElement('div');
        wrap.className = 'boundary-canvas-wrap';
        wrap.innerHTML = `<div style="font-size:0.75rem;font-weight:700;color:${a.color};margin-bottom:4px">${a.shortName}</div>
          <div style="font-size:0.65rem;color:var(--muted);margin-bottom:4px">X: arrival/min · Y: clinicians</div>
          <canvas id="fig8-${id}" width="300" height="180"></canvas>`;
        grid.appendChild(wrap);
    });
}

// ---- Generate recommendations ----
function generateRecommendations(results) {
    const el = document.getElementById('rec-grid');
    el.innerHTML = '';
    const thr = SimState.thresholds;
    const recs = [];

    results.forEach(r => {
        const a = ARCHITECTURES.find(x => x.id === r.archId);
        const s = r.summary;

        if (s.finalZone === 'green' && s.safetyScore >= 85) {
            recs.push({ type: 'success', icon: '✅', title: `${a.shortName}: Recommended`, body: `Stable under current load. Safety score: ${s.safetyScore.toFixed(0)}. Escalation success: ${s.escalationSuccess.toFixed(1)}%.` });
        }
        if (s.clinicianUtil > thr.maxClinicianUtil) {
            recs.push({ type: 'warning', icon: '⚠️', title: `Add Clinicians (${a.shortName})`, body: `Clinician utilization at ${s.clinicianUtil.toFixed(1)}% exceeds ${thr.maxClinicianUtil}% threshold. Recommend +${Math.ceil((s.clinicianUtil - thr.maxClinicianUtil) / 15)} clinician(s).` });
        }
        if (s.dropRate > thr.maxDropRate) {
            recs.push({ type: 'danger', icon: '🚨', title: `Queue Overflow (${a.shortName})`, body: `Drop rate ${s.dropRate.toFixed(1)}% > ${thr.maxDropRate}% threshold. Increase queue capacity or reduce arrival rate.` });
        }
        if (s.escalationSuccess < thr.minEscalationSuccess) {
            recs.push({ type: 'danger', icon: '🔴', title: `Escalation Failure (${a.shortName})`, body: `Escalation success ${s.escalationSuccess.toFixed(1)}% < ${thr.minEscalationSuccess}% minimum. Clinical safety compromised.` });
        }
        if (s.criticalDelayMin > thr.maxCriticalDelayMin) {
            recs.push({ type: 'danger', icon: '⏱️', title: `Critical Delay Exceeded (${a.shortName})`, body: `Critical patient delay ${s.criticalDelayMin.toFixed(1)} min > ${thr.maxCriticalDelayMin} min threshold. Prioritization logic must be reinforced.` });
        }
    });

    // Scenario-based recommendations
    const scen = SCENARIOS.find(s => s.id === SimState.selectedScenario);
    if (scen) {
        if (scen.id === 'normal') recs.push({ type: 'info', icon: 'ℹ️', title: 'Normal Load: All Architectures Viable', body: 'Under normal conditions, Centralized AI provides best speed. Consider for baseline deployment.' });
        if (scen.id === 'stress' || scen.id === 'surge') recs.push({ type: 'warning', icon: '⚡', title: 'Surge Condition: Activate Hybrid Mode', body: 'Tiered Hybrid architecture recommended for surge scenarios to distribute load across multiple AI nodes.' });
        if (scen.id === 'extreme' || scen.id === 'combined') recs.push({ type: 'danger', icon: '🆘', title: 'Extreme: Deploy Distributed Mode + Extra Clinicians', body: 'Hybrid architecture is the only viable option. Immediately recruit additional clinicians and expand queue capacity.' });
        if (scen.id === 'scarce') recs.push({ type: 'warning', icon: '🏥', title: 'Resource Scarcity: Human-in-Loop Risk Reduction', body: 'Human-in-the-Loop architecture provides lower confidence degradation under resource constraints. Prioritize critical case escalation.' });
    }

    if (!recs.length) {
        recs.push({ type: 'success', icon: '✅', title: 'All Systems Nominal', body: 'All architectures operating within threshold limits for current scenario.' });
    }

    recs.forEach(rec => {
        const card = document.createElement('div');
        card.className = `rec-card ${rec.type}`;
        card.innerHTML = `<div class="rec-icon">${rec.icon}</div><div class="rec-title">${rec.title}</div><div class="rec-body">${rec.body}</div>`;
        el.appendChild(card);
    });
}

// ---- Main run function ----
function runSimulation() {
    collectParams();
    const selectedArchs = ARCHITECTURES.filter(a => SimState.selectedArchIds.includes(a.id));
    const scenario = SCENARIOS.find(s => s.id === SimState.selectedScenario);
    if (!scenario || !selectedArchs.length) return;

    // Show spinner
    const spinner = document.getElementById('spinner');
    spinner.classList.add('visible');
    document.getElementById('spinner-msg').textContent = 'Running simulation…';

    setTimeout(() => {
        try {
            // 1. Run main simulation for each arch
            const results = selectedArchs.map(arch => {
                const rng = seededRNG(SimState.params.seed);
                const sim = new TriageSimulation(arch, scenario, SimState.params, rng);
                return sim.run(SimState.thresholds);
            });
            SimState.results = results;

            // 2. Monte Carlo
            document.getElementById('spinner-msg').textContent = 'Running Monte Carlo…';
            const mcResults = {};
            selectedArchs.forEach(arch => {
                mcResults[arch.id] = runMonteCarlo(arch, scenario, SimState.params, SimState.thresholds, SimState.params.mcRuns);
            });
            SimState.mcResults = mcResults;

            // 3. Failure boundary maps
            document.getElementById('spinner-msg').textContent = 'Computing boundary maps…';
            const boundaryMaps = {};
            selectedArchs.forEach(arch => {
                boundaryMaps[arch.id] = buildFailureBoundaryMap(arch, scenario, SimState.params, SimState.thresholds);
            });
            SimState.boundaryMaps = boundaryMaps;

            // 4. Update UI
            buildBoundaryCanvases(SimState.selectedArchIds);
            updateAllFigures(results, mcResults, boundaryMaps);

            // 5. Find worst zone across all archs
            const zones = ['green', 'yellow', 'orange', 'red'];
            const worstZone = results.reduce((worst, r) => {
                const zi = zones.indexOf(r.summary.finalZone);
                return zi > zones.indexOf(worst) ? r.summary.finalZone : worst;
            }, 'green');
            updateZoneBadge(worstZone);
            updateKPIs(results);
            updateTTF(results);
            generateRecommendations(results);
            renderReproPanel();

        } catch (e) {
            console.error('Simulation error:', e);
        } finally {
            spinner.classList.remove('visible');
        }
    }, 50);
}

// ---- Reset ----
function resetDashboard() {
    SimState.results = null; SimState.mcResults = null; SimState.boundaryMaps = null;
    initAllFigures();
    updateZoneBadge('green');
    ['kpi-wait','kpi-crit','kpi-escal','kpi-drop','kpi-util','kpi-safety'].forEach(id => {
        const el = document.getElementById(id);
        el.textContent = '—'; el.className = 'kpi-value';
    });
    ['ttf-yellow','ttf-orange','ttf-red'].forEach(id => document.getElementById(id).textContent = '—');
    document.getElementById('rec-grid').innerHTML = `<div class="rec-card info"><div class="rec-icon">ℹ️</div><div class="rec-title">Run Simulation</div><div class="rec-body">Configure parameters and click Run Simulation.</div></div>`;
    document.getElementById('repro-content').innerHTML = '<pre>{ "status": "No simulation run yet." }</pre>';
    document.getElementById('fig8-grid').innerHTML = '';
}

// ---- Wire export buttons ----
document.getElementById('btn-export-all').addEventListener('click', exportAllFiguresPNG);
document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
document.getElementById('btn-export-json').addEventListener('click', exportJSON);
document.getElementById('btn-export-log').addEventListener('click', exportSimLog);
document.getElementById('exp-csv').addEventListener('click', exportCSV);
document.getElementById('exp-json').addEventListener('click', exportJSON);
document.getElementById('exp-log').addEventListener('click', exportSimLog);

// ---- Boot ----
document.getElementById('btn-run').addEventListener('click', runSimulation);
document.getElementById('btn-reset').addEventListener('click', resetDashboard);

buildScenarioButtons();
buildArchToggles();
buildArchDiagrams();
bindSeveritySliders();
initAllFigures();
