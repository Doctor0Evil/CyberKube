import crypto from "node:crypto";

export function createCitizenRunEnvelope(runId, citizenId, safetyProfile, inputs, metrics, outputs, context) {
  if (!runId) throw new Error("createCitizenRunEnvelope requires a runId.");
  const timestamp = new Date().toISOString();

  const envelope = {
    version: "1.0.0",
    kind: "CyberKubeCitizenRun",
    timestamp,
    runId,
    citizenId,
    runMeta: {
      intent: context?.intent || "unspecified",
      mode: context?.mode || "cyberswarm-run",
      environment: {
        cyberkubeVersion: context?.cyberkubeVersion || "0.1.0",
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    },
    safetyProfile: safetyProfile ? safetyProfile.toJSON() : null,
    inputsSummary: inputs,
    metrics,
    outputsSummary: outputs,
    sovereignty: {
      did: context?.did || null,
      walletAddress: context?.walletAddress || null,
      bostromAddress: context?.bostromAddress || null
    },
    risksNoted: Array.isArray(context?.risksNoted) ? context.risksNoted : [],
    assumptions: Array.isArray(context?.assumptions) ? context.assumptions : [],
    notes: Array.isArray(context?.notes) ? context.notes : []
  };

  const serialized = JSON.stringify(envelope);
  const contentHash = crypto.createHash("sha256").update(serialized).digest("hex");
  envelope.contentHash = contentHash;

  return envelope;
}
