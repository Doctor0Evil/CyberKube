-- swarm_neuro_decisions: CAPA/post-market analysis table for swarm neuro decisions
-- Mirrors SwarmNeuroGovernanceKernel envelope + anchorSeed.

CREATE TABLE IF NOT EXISTS swarm_neuro_decisions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id            TEXT    NOT NULL,   -- governance runId / decisionId
  timestamp_utc     TEXT    NOT NULL,   -- ISO 8601 from envelope.timestamp
  subject_id        TEXT,              -- human subject or implant ID
  swarm_id          TEXT,              -- swarm / cluster identifier
  jurisdiction      TEXT,              -- e.g., 'CL', 'US', 'EU'
  consent_profile   TEXT,              -- e.g., 'cl-medical-therapeutic'

  risk_class        TEXT    NOT NULL,   -- 'neural-write', 'stimulation', etc.
  allowed           INTEGER NOT NULL,   -- 1 = allowed, 0 = blocked
  tier              TEXT    NOT NULL,   -- 'auto-use', 'show-with-warning', 'quarantine'
  operator_id       TEXT,              -- human operator identifier
  operator_role     TEXT,              -- 'clinician', 'engineer', etc.
  mode              TEXT,              -- 'swarm-neuro', 'autonomous', 'human-integrated'

  violations_json   TEXT    NOT NULL,   -- JSON array of violation codes
  safety_profile_json TEXT  NOT NULL,   -- JSON snapshot from safetyProfile.toJSON()
  inputs_summary_json TEXT  NOT NULL,   -- JSON from inputsSummary
  outputs_summary_json TEXT NOT NULL,   -- JSON from outputsSummary

  metrics_json      TEXT    NOT NULL,   -- JSON metrics from envelope.metrics
  anchor_seed_json  TEXT,              -- JSON anchorSeed (contentHash, DID, chain, etc.)
  content_hash      TEXT    NOT NULL,   -- envelope.contentHash

  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_swarm_neuro_decisions_run_id
  ON swarm_neuro_decisions (run_id);

CREATE INDEX IF NOT EXISTS idx_swarm_neuro_decisions_timestamp
  ON swarm_neuro_decisions (timestamp_utc);

CREATE INDEX IF NOT EXISTS idx_swarm_neuro_decisions_subject
  ON swarm_neuro_decisions (subject_id);

CREATE INDEX IF NOT EXISTS idx_swarm_neuro_decisions_risk_class
  ON swarm_neuro_decisions (risk_class);

CREATE INDEX IF NOT EXISTS idx_swarm_neuro_decisions_jurisdiction
  ON swarm_neuro_decisions (jurisdiction);

CREATE INDEX IF NOT EXISTS idx_swarm_neuro_decisions_tier
  ON swarm_neuro_decisions (tier);
