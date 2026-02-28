export class RobotKubeSafetyProfile {
  constructor(config = {}) {
    this.profileName = config.profileName || "rk-default-citizen-edge";
    this.cpuBudgetMillis = config.cpuBudgetMillis ?? 50;
    this.msgBudget = config.msgBudget ?? 500;
    this.swarmFanoutBudget = config.swarmFanoutBudget ?? 32;
    this.actuationBudget = config.actuationBudget ?? 64;
    this.maxRunSeconds = config.maxRunSeconds ?? 2.0;

    this.minConfidenceForAutoUse = config.minConfidenceForAutoUse ?? 0.9;
    this.minConfidenceForDisplay = config.minConfidenceForDisplay ?? 0.5;
    this.maxDriftForAutoUse = config.maxDriftForAutoUse ?? 0.15;
    this.maxDriftForCitizenUI = config.maxDriftForCitizenUI ?? 0.5;

    this.context = {
      role: config.context?.role || "augmented-citizen",
      deviceClass: config.context?.deviceClass || "edge-robotkube-node",
      networkTrust: config.context?.networkTrust || "unknown",
      consentLevel: config.context?.consentLevel || "minimal",
      locationHint: config.context?.locationHint || null
    };

    this.redactPatterns = config.redactPatterns || [
      { name: "email", regex: /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
      { name: "geo-lat-lon", regex: /\b-?\d{1,2}\.\d{4,8},\s*-?\d{1,3}\.\d{4,8}\b/g }
    ];
  }

  enforceBudgets(stats) {
    const violations = [];
    if (typeof stats.cpuMillis === "number" && stats.cpuMillis > this.cpuBudgetMillis) {
      violations.push(`CPU budget exceeded ${stats.cpuMillis} > ${this.cpuBudgetMillis}`);
    }
    if (typeof stats.msgCount === "number" && stats.msgCount > this.msgBudget) {
      violations.push(`Message budget exceeded ${stats.msgCount} > ${this.msgBudget}`);
    }
    if (typeof stats.swarmFanout === "number" && stats.swarmFanout > this.swarmFanoutBudget) {
      violations.push(`Swarm fanout exceeded ${stats.swarmFanout} > ${this.swarmFanoutBudget}`);
    }
    if (typeof stats.actuations === "number" && stats.actuations > this.actuationBudget) {
      violations.push(`Actuation budget exceeded ${stats.actuations} > ${this.actuationBudget}`);
    }
    if (typeof stats.runSeconds === "number" && stats.runSeconds > this.maxRunSeconds) {
      violations.push(`Max run seconds exceeded ${stats.runSeconds} > ${this.maxRunSeconds}`);
    }
    if (violations.length) {
      const err = new Error(`RobotKubeSafetyProfile.enforceBudgets violations: ${violations.join("; ")}`);
      err.violations = violations;
      throw err;
    }
    return { ok: true, violations };
  }

  classifyBehavior(behavior) {
    const confidence = behavior.confidence ?? 0;
    const drift = behavior.drift ?? 1;
    const flags = [];

    if (confidence >= this.minConfidenceForAutoUse) flags.push("high-confidence");
    else if (confidence >= this.minConfidenceForDisplay) flags.push("display-ok");
    else flags.push("low-confidence");

    if (drift <= this.maxDriftForAutoUse) flags.push("low-drift");
    else if (drift <= this.maxDriftForCitizenUI) flags.push("medium-drift");
    else flags.push("high-drift");

    let tier = "quarantine";
    const autoUseOk = confidence >= this.minConfidenceForAutoUse && drift <= this.maxDriftForAutoUse;
    const showWithWarningOk =
      !autoUseOk && confidence >= this.minConfidenceForDisplay && drift <= this.maxDriftForCitizenUI;

    if (autoUseOk) tier = "auto-use";
    else if (showWithWarningOk) tier = "show-with-warning";

    return {
      id: behavior.id,
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

  redactTelemetry(text) {
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
      cpuBudgetMillis: this.cpuBudgetMillis,
      msgBudget: this.msgBudget,
      swarmFanoutBudget: this.swarmFanoutBudget,
      actuationBudget: this.actuationBudget,
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
