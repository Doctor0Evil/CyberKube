export class CyberKubeSafetyProfile {
  constructor(config = {}) {
    this.profileName = config.profileName || "ck-default-aug-citizen";
    this.maxActuationPerSecond = config.maxActuationPerSecond ?? 20;
    this.maxSwarmSize = config.maxSwarmSize ?? 256;
    this.maxEdgeCpuMillis = config.maxEdgeCpuMillis ?? 80;
    this.maxNetworkKbps = config.maxNetworkKbps ?? 512;
    this.maxRunSeconds = config.maxRunSeconds ?? 2.0;

    this.minConfidenceForAutoUse = config.minConfidenceForAutoUse ?? 0.9;
    this.minConfidenceForDisplay = config.minConfidenceForDisplay ?? 0.5;
    this.maxDriftForAutoUse = config.maxDriftForAutoUse ?? 0.15;
    this.maxDriftForCitizenUI = config.maxDriftForCitizenUI ?? 0.5;

    this.context = {
      role: config.context?.role || "augmented-citizen",
      deviceClass: config.context?.deviceClass || "edge-cybernetic-node",
      networkTrust: config.context?.networkTrust || "unknown",
      consentLevel: config.context?.consentLevel || "minimal",
      locationHint: config.context?.locationHint || null
    };

    this.redactPatterns = config.redactPatterns || [
      { name: "email", regex: /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
      { name: "geo-lat-lon", regex: /\b-?\d{1,2}\.\d{4,8},\s*-?\d{1,3}\.\d{4,8}\b/g },
      { name: "device-id", regex: /\b(dev|hw)-[0-9a-f]{8,16}\b/gi }
    ];
  }

  enforceBudgets(stats) {
    const violations = [];

    if (typeof stats.actuationCount === "number" &&
        stats.actuationCount > this.maxActuationPerSecond) {
      violations.push(
        `Actuation budget exceeded ${stats.actuationCount} > ${this.maxActuationPerSecond}`
      );
    }

    if (typeof stats.swarmSize === "number" && stats.swarmSize > this.maxSwarmSize) {
      violations.push(`Swarm size exceeded ${stats.swarmSize} > ${this.maxSwarmSize}`);
    }

    if (typeof stats.edgeCpuMillis === "number" &&
        stats.edgeCpuMillis > this.maxEdgeCpuMillis) {
      violations.push(
        `Edge CPU budget exceeded ${stats.edgeCpuMillis} > ${this.maxEdgeCpuMillis}`
      );
    }

    if (typeof stats.networkKbps === "number" &&
        stats.networkKbps > this.maxNetworkKbps) {
      violations.push(
        `Network bandwidth budget exceeded ${stats.networkKbps} > ${this.maxNetworkKbps}`
      );
    }

    if (typeof stats.runSeconds === "number" &&
        stats.runSeconds > this.maxRunSeconds) {
      violations.push(
        `Max run seconds exceeded ${stats.runSeconds} > ${this.maxRunSeconds}`
      );
    }

    if (violations.length) {
      const err = new Error(
        `CyberKubeSafetyProfile.enforceBudgets violations: ${violations.join("; ")}`
      );
      err.violations = violations;
      throw err;
    }

    return { ok: true, violations };
  }

  classifyAction(action) {
    const confidence = action.confidence ?? 0;
    const drift = action.drift ?? 1;
    const flags = [];

    if (confidence >= this.minConfidenceForAutoUse) flags.push("high-confidence");
    else if (confidence >= this.minConfidenceForDisplay) flags.push("display-ok");
    else flags.push("low-confidence");

    if (drift <= this.maxDriftForAutoUse) flags.push("low-drift");
    else if (drift <= this.maxDriftForCitizenUI) flags.push("medium-drift");
    else flags.push("high-drift");

    let tier = "quarantine";
    const autoUseOk = confidence >= this.minConfidenceForAutoUse &&
                      drift <= this.maxDriftForAutoUse;
    const showWithWarningOk =
      !autoUseOk &&
      confidence >= this.minConfidenceForDisplay &&
      drift <= this.maxDriftForCitizenUI;

    if (autoUseOk) tier = "auto-use";
    else if (showWithWarningOk) tier = "show-with-warning";

    return {
      id: action.id,
      tier,
      rationale: {
        confidence,
        drift,
        thresholds: {
          minConfidenceForAutoUse: this.minConfidenceForAutoUse,
          minConfidenceForDisplay: this.minConfidenceForDisplay,
          maxDriftForAutoUse: this.maxDriftForAutoUse,
          maxDriftForCitizenUI: this.maxDriftForCitizenUI
        },
        context: this.context
      },
      flags
    };
  }

  redact(text) {
    if (typeof text !== "string" || !text.length) {
      return { redacted: text, matches: [] };
    }
    let redacted = text;
    const matches = [];

    for (const pattern of this.redactPatterns) {
      const regex = pattern.regex;
      if (!regex || !(regex instanceof RegExp)) continue;

      const found = [];
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(text)) !== null) {
        found.push(m[0]);
      }
      if (found.length) {
        matches.push({ name: pattern.name, count: found.length });
        redacted = redacted.replace(regex, "[REDACTED]");
      }
    }

    return { redacted, matches };
  }

  toJSON() {
    return {
      profileName: this.profileName,
      maxActuationPerSecond: this.maxActuationPerSecond,
      maxSwarmSize: this.maxSwarmSize,
      maxEdgeCpuMillis: this.maxEdgeCpuMillis,
      maxNetworkKbps: this.maxNetworkKbps,
      maxRunSeconds: this.maxRunSeconds,
      minConfidenceForAutoUse: this.minConfidenceForAutoUse,
      minConfidenceForDisplay: this.minConfidenceForDisplay,
      maxDriftForAutoUse: this.maxDriftForAutoUse,
      maxDriftForCitizenUI: this.maxDriftForCitizenUI,
      context: this.context,
      redactPatterns: this.redactPatterns.map(p => ({ name: p.name }))
    };
  }
}
