import fs from "node:fs";
import path from "node:path";

function loadChileProfiles(configPath) {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const json = JSON.parse(raw);
    if (!json || !json.profiles) return null;
    return json.profiles;
  } catch {
    return null;
  }
}

export class NeurorightsPolicyEngine {
  constructor(config) {
    const profilesPath =
      config?.chileProfilesPath ||
      path.join(process.cwd(), "config", "chile_neurorights_consent_profiles.json");
    this.chileProfiles = loadChileProfiles(profilesPath);

    this.config = {
      requireExplicitConsentForRisk: ["neural-write", "stimulation", "personality-drift"],
      requireHumanOversightForRisk: ["stimulation", "personality-drift"],
      maxAdaptiveRateHz: 0.5,
      ...config
    };
  }

  evaluateRequest(request) {
    const {
      subjectId,
      riskClass,
      consent,
      operatorRole,
      mode,
      jurisdiction,
      consentProfile
    } = request;

    const violations = [];

    // Chile-specific overlay if applicable
    if (jurisdiction === "CL" && this.chileProfiles && consentProfile) {
      const profile = this.chileProfiles[consentProfile];
      if (profile) {
        if (profile.riskClasses.includes(riskClass) === false &&
            consentProfile !== "cl-prohibited-contexts") {
          violations.push("risk-class-not-allowed-in-profile");
        }
        if (profile.requireExplicitConsent && consent?.level !== "explicit") {
          violations.push("chile-explicit-consent-required");
        }
        if (!profile.allowAutonomousExecution && mode === "autonomous") {
          violations.push("autonomous-execution-not-allowed");
        }
        if (consentProfile === "cl-prohibited-contexts") {
          violations.push("prohibited-context-under-chile-law-21469");
        }
      }
    }

    // existing generic checks (as before) ...
    // this._updateRateWindow, requireHumanOversightForRisk, etc.
    // and finally return { allowed, tier, violations, evaluatedAt, window }
  }
}
