// ============================================================
// ARCHITECTURE DEFINITIONS
// 3 system architectures compared in the paper
// ============================================================

const ARCHITECTURES = [
    {
        id: 'centralized',
        name: 'Centralized AI Triage',
        shortName: 'Centralized',
        color: '#3b82f6',
        colorAlpha: 'rgba(59,130,246,0.15)',
        aiNodes: 1,
        clinicians: 3,
        triageDesks: 2,
        queueCap: 100,
        aiProcessSeconds: 8,           // seconds AI takes per patient
        clinicianServiceSeconds: 300,  // 5 min per patient
        aiBaseConfidence: 0.92,
        confidenceDegradation: 0.18,   // max degradation at full load
        uncertaintyThreshold: 0.72,    // below this → escalate
        description: 'Single centralized AI node handles all triage. Fast but single point of failure.',
        complexity: 2
    },
    {
        id: 'human_loop',
        name: 'Human-in-the-Loop',
        shortName: 'Human-Loop',
        color: '#8b5cf6',
        colorAlpha: 'rgba(139,92,246,0.15)',
        aiNodes: 1,
        clinicians: 6,
        triageDesks: 3,
        queueCap: 80,
        aiProcessSeconds: 20,          // AI + human review
        clinicianServiceSeconds: 480,  // 8 min (more thorough)
        aiBaseConfidence: 0.86,
        confidenceDegradation: 0.06,   // human oversight reduces error cascade
        uncertaintyThreshold: 0.82,    // higher threshold → more escalations
        description: 'AI assists but every decision requires human confirmation. Safer, slower.',
        complexity: 4
    },
    {
        id: 'hybrid',
        name: 'Tiered Hybrid Triage',
        shortName: 'Hybrid',
        color: '#10b981',
        colorAlpha: 'rgba(16,185,129,0.15)',
        aiNodes: 3,
        clinicians: 4,
        triageDesks: 4,
        queueCap: 150,
        aiProcessSeconds: 12,          // moderate
        clinicianServiceSeconds: 360,  // 6 min
        aiBaseConfidence: 0.90,
        confidenceDegradation: 0.10,
        uncertaintyThreshold: 0.76,
        description: 'Tiered: AI handles low/medium severity autonomously; clinicians focus on high/critical.',
        complexity: 6
    }
];
