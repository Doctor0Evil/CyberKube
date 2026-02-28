// Safety + transparency + anchoring spine for CyberKube swarms in ALN/Googolswarm environments.

import crypto from "node:crypto";
import AnchoringService from "../anchoring/AnchoringService.js";

// SwarmSafetyProfile: medical, neurorights, and ZTA constraints for a single swarm operation.
export class SwarmSafetyProfile {
  constructor(config = {}) {
    this.profileName = config.profileName || "cyberkube-medical-default";

    // Medical safety limits (examples, units are domain-specific).
    this.maxEnergyDose = config.maxEnergyDose ?? 1.0;          // e.g., Joules per cm^2
    this.maxContactForce = config.maxContactForce ?? 0.5;      // e.g., Newtons
    this.max dwellSeconds = config.maxDwellSeconds ?? 600;     // max time in sensitive zone
    this.maxSwarmDensity = config.maxSwarmDensity ?? 0.2;      // fraction of volume

    // Operational budgets (runtime safety).
    this.maxAgents = config.maxAgents ?? 1000;
    this.maxAgentStepRateHz = config.maxAgentStepRateHz ?? 50;
    this.maxRunSeconds = config.maxRunSeconds ?? 900;

    // Neurorights-aware controls.
    this.allowDirectNeuroRead = !!config.allowDirectNeuroRead && config.consentLevel === "explicit-medical";
    this.allowNeuroWrite = false; // default: no write access to neurointerfaces.
    this.neuroDataMinimization = config.neuroDataMinimization ?? true;

    // Context from ALN and device layer.
    this.context = {
      patientDid: config.context?.patientDid || null,
      operatorDid: config.context?.operatorDid || null,
      facilityId: config.context?.facilityId || null,
      procedureCode: config.context?.procedureCode || null,
      networkTrust: config.context?.networkTrust || "unknown",
      consentLevel: config.context?.consentLevel || "minimal",
      locationHint: config.context?.locationHint || null
    };
  }

  enforceRuntimeBudgets(stats) {
    const violations = [];

    if (typeof stats.agentCount === "number" && stats.agentCount > this.maxAgents) {
      violations.push(`Agent count exceeded: ${stats.agentCount} > ${this.maxAgents}`);
    }
    if (typeof stats.maxStepRateHz === "number" && stats.maxStepRateHz > this.maxAgentStepRateHz) {
      violations.push(`Step rate exceeded: ${stats.maxStepRateHz} > ${this.maxAgentStepRateHz}`);
    }
    if (typeof stats.runSeconds === "number" && stats.runSeconds > this.maxRunSeconds) {
      violations.push(`Run duration exceeded: ${stats.runSeconds} > ${this.maxRunSeconds}`);
    }

    if (violations.length > 0) {
      const err = new Error("SwarmSafetyProfile.enforceRuntimeBudgets violations");
      err.violations = violations;
      throw err;
    }

    return { ok: true, violations: [] };
  }

  enforceMedicalEnvelope(snapshot) {
    const violations = [];

    if (typeof snapshot.energyDose === "number" && snapshot.energyDose > this.maxEnergyDose) {
      violations.push(`Energy dose exceeded: ${snapshot.energyDose} > ${this.maxEnergyDose}`);
    }
    if (typeof snapshot.maxContactForce === "number" && snapshot.maxContactForce > this.maxContactForce) {
      violations.push(`Contact force exceeded: ${snapshot.maxContactForce} > ${this.maxContactForce}`);
    }
    if (typeof snapshot.dwellSeconds === "number" && snapshot.dwellSeconds > this.maxDwellSeconds) {
      violations.push(`Dwell time exceeded: ${snapshot.dwellSeconds} > ${this.maxDwellSeconds}`);
    }
    if (typeof snapshot.swarmDensity === "number" && snapshot.swarmDensity > this.maxSwarmDensity) {
      violations.push(`Swarm density exceeded: ${snapshot.swarmDensity} > ${this.maxSwarmDensity}`);
    }

    if (!this.allowDirectNeuroRead && snapshot.neuroReadPerformed) {
      violations.push("Direct neuro read attempted under a profile that forbids it.");
    }
    if (snapshot.neuroWritePerformed) {
      violations.push("Neuro write operations are globally disabled in SwarmSafetyProfile.");
    }

    if (violations.length > 0) {
      const err = new Error("SwarmSafetyProfile.enforceMedicalEnvelope violations");
      err.violations = violations;
      throw err;
    }

    return { ok: true, violations: [] };
  }

  toJSON() {
    return {
      profileName: this.profileName,
      maxEnergyDose: this.maxEnergyDose,
      maxContactForce: this.maxContactForce,
      maxDwellSeconds: this.maxDwellSeconds,
      maxSwarmDensity: this.maxSwarmDensity,
      maxAgents: this.maxAgents,
      maxAgentStepRateHz: this.maxAgentStepRateHz,
      maxRunSeconds: this.maxRunSeconds,
      allowDirectNeuroRead: this.allowDirectNeuroRead,
      allowNeuroWrite: this.allowNeuroWrite,
      neuroDataMinimization: this.neuroDataMinimization,
      context: this.context
    };
  }
}

// SwarmTransparencyEnvelope: evidence log for one CyberKube operation.
export function createSwarmTransparencyEnvelope(runMeta, safetyProfile, inputsSummary, metrics, outputsSummary, risksNoted = [], assumptions = [], notes = []) {
  if (!runMeta || !runMeta.runId) {
    throw new Error("createSwarmTransparencyEnvelope requires runMeta.runId");
  }

  const timestamp = new Date().toISOString();

  const envelope = {
    version: "1.0.0",
    timestamp,
    runId: runMeta.runId,
    runMeta: {
      intent: runMeta.intent || "unspecified",
      procedureCode: runMeta.procedureCode || null,
      mode: "cyberkube-swarm",
      patientDid: runMeta.patientDid || null,
      operatorDid: runMeta.operatorDid || null,
      facilityId: runMeta.facilityId || null,
      environment: {
        controllerVersion: runMeta.controllerVersion || "unknown",
        swarmFirmwareVersion: runMeta.swarmFirmwareVersion || "unknown",
        nodePlatform: runMeta.nodePlatform || process.platform,
        nodeArch: runMeta.nodeArch || process.arch
      }
    },
    safetyProfile: safetyProfile ? safetyProfile.toJSON() : null,
    inputsSummary: inputsSummary || {},
    metrics: metrics || {},
    outputsSummary: outputsSummary || {},
    risksNoted: Array.isArray(risksNoted) ? risksNoted : [],
    assumptions: Array.isArray(assumptions) ? assumptions : [],
    notes: Array.isArray(notes) ? notes : []
  };

  const serialized = JSON.stringify(envelope);
  const contentHash = crypto.createHash("sha256").update(serialized).digest("hex");
  envelope.contentHash = contentHash;

  return envelope;
}

// SwarmAnchorService: wraps AnchoringService to create and anchor a CyberKube manifest.
export class SwarmAnchorService {
  constructor(anchoringConfig = {}) {
    this.service = new AnchoringService(anchoringConfig);
  }

  createManifest(runMeta, envelope, safetyProfile, nanoMetrics, deviceContext, alnContext) {
    // AnchoringService.createManifest already expects this shape in your core.
    return this.service.createManifest(
      { ...runMeta, runId: runMeta.runId },
      envelope,
      safetyProfile,
      deviceContext,
      alnContext,
      nanoMetrics
    );
  }

  async anchorManifest(manifest) {
    return this.service.anchorManifest(manifest);
  }
}

// Helper: run a swarm operation under a SwarmSafetyProfile and produce envelope + anchors.
export async function runSwarmWithSafetyAndAnchoring(runMeta, profileConfig, executeSwarm, anchoringConfig, inputsSummaryBuilder, outputsSummaryBuilder, nanoMetricsBuilder, alnContextBuilder) {
  const safetyProfile = new SwarmSafetyProfile(profileConfig || {});
  const startedAt = process.hrtime.bigint();

  // executeSwarm must implement the actual CyberKube control loop and return stats + snapshots.
  const result = await executeSwarm(safetyProfile);

  const endedAt = process.hrtime.bigint();
  const elapsedSeconds = Number(endedAt - startedAt) / 1e9;

  const metrics = {
    agentCount: result.agentCount ?? 0,
    maxStepRateHz: result.maxStepRateHz ?? 0,
    runSeconds: elapsedSeconds,
    energyDose: result.energyDose ?? 0,
    maxContactForce: result.maxContactForce ?? 0,
    dwellSeconds: result.dwellSeconds ?? 0,
    swarmDensity: result.swarmDensity ?? 0,
    anomalyScore: result.anomalyScore ?? 0
  };

  // Enforce runtime and medical constraints.
  safetyProfile.enforceRuntimeBudgets(metrics);
  safetyProfile.enforceMedicalEnvelope({
    energyDose: metrics.energyDose,
    maxContactForce: metrics.maxContactForce,
    dwellSeconds: metrics.dwellSeconds,
    swarmDensity: metrics.swarmDensity,
    neuroReadPerformed: !!result.neuroReadPerformed,
    neuroWritePerformed: !!result.neuroWritePerformed
  });

  const inputsSummary = typeof inputsSummaryBuilder === "function" ? inputsSummaryBuilder(result) : {};
  const outputsSummary = typeof outputsSummaryBuilder === "function" ? outputsSummaryBuilder(result) : {
    completionState: result.completionState || "unknown",
    failsafesTriggered: result.failsafesTriggered || [],
    agentAbortCount: result.agentAbortCount ?? 0
  };

  const envelope = createSwarmTransparencyEnvelope(
    runMeta,
    safetyProfile,
    inputsSummary,
    metrics,
    outputsSummary,
    result.risksNoted || [],
    result.assumptions || [],
    result.notes || []
  );

  const nanoMetrics = typeof nanoMetricsBuilder === "function" ? nanoMetricsBuilder(result, metrics) : null;
  const deviceContext = {
    nodeId: runMeta.nodeId || null,
    hardwareClass: runMeta.hardwareClass || null
  };
  const alnContext = typeof alnContextBuilder === "function" ? alnContextBuilder(result, metrics) : null;

  const anchorService = new SwarmAnchorService(anchoringConfig || {});
  const manifest = anchorService.createManifest(runMeta, envelope, safetyProfile, nanoMetrics, deviceContext, alnContext);
  const anchored = await anchorService.anchorManifest(manifest);

  return {
    result,
    safetyProfile,
    metrics,
    envelope,
    manifest: anchored.manifest,
    commitments: anchored.commitments
  };
}

export default {
  SwarmSafetyProfile,
  createSwarmTransparencyEnvelope,
  SwarmAnchorService,
  runSwarmWithSafetyAndAnchoring
};
