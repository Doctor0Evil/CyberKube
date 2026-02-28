import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function openDb(dbPath = "cyberkube.sqlite") {
  return open({ filename: dbPath, driver: sqlite3.Database });
}

export async function saveSwarmNeuroDecision(db, envelope, anchorSeed, extras) {
  const sql = `
    INSERT INTO swarm_neuro_decisions (
      run_id, timestamp_utc, subject_id, swarm_id, jurisdiction, consent_profile,
      risk_class, allowed, tier, operator_id, operator_role, mode,
      violations_json, safety_profile_json, inputs_summary_json, outputs_summary_json,
      metrics_json, anchor_seed_json, content_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const { runId, timestamp, safetyProfile, inputsSummary, outputsSummary, metrics,
          risksNoted, runMeta, contentHash } = envelope;

  const params = [
    runId,
    timestamp,
    inputsSummary?.subjectId || null,
    extras?.swarmId || null,
    extras?.jurisdiction || null,
    extras?.consentProfile || null,
    outputsSummary?.riskClass || null,
    outputsSummary?.allowed ? 1 : 0,
    outputsSummary?.tier || "quarantine",
    extras?.operatorId || null,
    outputsSummary?.operatorRole || null,
    runMeta?.mode || "swarm-neuro",
    JSON.stringify(risksNoted || []),
    JSON.stringify(safetyProfile || {}),
    JSON.stringify(inputsSummary || {}),
    JSON.stringify(outputsSummary || {}),
    JSON.stringify(metrics || {}),
    anchorSeed ? JSON.stringify(anchorSeed) : null,
    contentHash
  ];

  await db.run(sql, params);
}
