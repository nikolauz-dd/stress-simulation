// ============================================================
// SCENARIO DEFINITIONS
// 6 test scenarios covering all conditions for Q1 paper
// ============================================================

const SCENARIOS = [
    {
        id: 'normal',
        name: 'Normal',
        label: 'Normal',
        badgeClass: 'badge-normal',
        arrivalRatePerMin: 4,
        severityMix: { low: 0.50, medium: 0.30, high: 0.15, critical: 0.05 },
        resourceMultiplier: 1.0,
        description: 'Standard operating conditions — baseline scenario.'
    },
    {
        id: 'stress',
        name: 'Stress',
        label: 'Stress',
        badgeClass: 'badge-stress',
        arrivalRatePerMin: 12,
        severityMix: { low: 0.35, medium: 0.35, high: 0.20, critical: 0.10 },
        resourceMultiplier: 1.0,
        description: 'Elevated patient volume with increased acuity mix.'
    },
    {
        id: 'extreme',
        name: 'Extreme',
        label: 'Extreme',
        badgeClass: 'badge-extreme',
        arrivalRatePerMin: 25,
        severityMix: { low: 0.20, medium: 0.30, high: 0.30, critical: 0.20 },
        resourceMultiplier: 1.0,
        description: 'Mass-casualty conditions — maximum patient volume and acuity.'
    },
    {
        id: 'surge',
        name: 'Surge Only',
        label: 'Surge Only',
        badgeClass: 'badge-surge',
        arrivalRatePerMin: 20,
        severityMix: { low: 0.50, medium: 0.30, high: 0.15, critical: 0.05 },
        resourceMultiplier: 1.0,
        description: 'High volume surge but normal severity distribution.'
    },
    {
        id: 'scarce',
        name: 'Resource Scarcity',
        label: 'Scarcity',
        badgeClass: 'badge-scarce',
        arrivalRatePerMin: 4,
        severityMix: { low: 0.35, medium: 0.35, high: 0.20, critical: 0.10 },
        resourceMultiplier: 0.5,
        description: 'Normal volume but only 50% of resources available.'
    },
    {
        id: 'combined',
        name: 'Surge + Scarcity',
        label: 'Combined',
        badgeClass: 'badge-combined',
        arrivalRatePerMin: 20,
        severityMix: { low: 0.20, medium: 0.30, high: 0.30, critical: 0.20 },
        resourceMultiplier: 0.5,
        description: 'Worst case: high volume surge combined with limited resources.'
    }
];

// Default threshold settings
const DEFAULT_THRESHOLDS = {
    maxAvgWaitMin: 5,           // max acceptable average wait (minutes)
    maxCriticalDelayMin: 10,    // max acceptable critical patient delay
    minEscalationSuccess: 95,   // min % escalation success rate
    maxDropRate: 5,             // max % patients dropped
    maxClinicianUtil: 85,       // max % clinician utilization
    minSafetyScore: 80          // min composite safety score
};
