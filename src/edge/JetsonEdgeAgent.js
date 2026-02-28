import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fetch from "node-fetch";
import pino from "pino";
import { v4 as uuidv4 } from "uuid";

import { CyberKubeSafetyProfile } from "../core/CyberKubeSafetyProfile.js";
import { createCitizenRunEnvelope } from "../core/CitizenTransparencyEnvelope.js";
import { requireHumanIntegratedMode } from "../core/SovereigntyContext.js";

const logger = pino({ level: process.env.CYBERKUBE_LOG_LEVEL || "info" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANCHOR_GATEWAY_URL =
  process.env.CYBERKUBE_ANCHOR_GATEWAY_URL ||
  "http://cyberkube-anchor-gateway-svc.cyberkube.svc.cluster.local";

const JETSON_FAMILY = process.env.JETSON_FAMILY || "unknown";
const JETSON_POWER_MODE = process.env.JETSON_POWER_MODE || "unknown";

function readBatterySoc() {
  try {
    const supplyDir = "/sys/class/power_supply";
    const entries = fs.readdirSync(supplyDir);
    const battery = entries.find(e => e.toLowerCase().includes("bat"));
    if (!battery) return null;
    const socPath = path.join(supplyDir, battery, "capacity");
    const raw = fs.readFileSync(socPath, "utf8").trim();
    const soc = Number.parseInt(raw, 10);
    if (Number.isNaN(soc)) return null;
    return soc;
  } catch (err) {
    logger.warn({ err }, "Failed to read battery SoC");
    return null;
  }
}

function computeLocalBudgets() {
  const soc = readBatterySoc();
  if (soc == null) {
    return {
      maxActuationPerSecond: 10,
      maxEdgeCpuMillis: 50,
      maxNetworkKbps: 256
    };
  }
  if (soc >= 50) {
    return {
      maxActuationPerSecond: 30,
      maxEdgeCpuMillis: 80,
      maxNetworkKbps: 512
    };
  }
  if (soc >= 25) {
    return {
      maxActuationPerSecond: 15,
      maxEdgeCpuMillis: 60,
      maxNetworkKbps: 384
    };
  }
  return {
    maxActuationPerSecond: 5,
    maxEdgeCpuMillis: 40,
    maxNetworkKbps: 192
  };
}

async function postEnvelope(envelope) {
  try {
    const res = await fetch(`${ANCHOR_GATEWAY_URL}/envelopes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope)
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error(
        { status: res.status, body: text },
        "Failed to post envelope to anchor gateway"
      );
    } else {
      logger.info(
        { runId: envelope.runId, contentHash: envelope.contentHash },
        "Envelope posted to anchor gateway"
      );
    }
  } catch (err) {
    logger.error({ err }, "Error posting envelope to anchor gateway");
  }
}

function startHttpServer(profile) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", jetson: { family: JETSON_FAMILY, powerMode: JETSON_POWER_MODE } }));
      return;
    }

    if (req.method === "POST" && req.url === "/telemetry") {
      let body = "";
      req.on("data", chunk => {
        body += chunk;
        if (body.length > 1_000_000) {
          req.destroy();
        }
      });
      req.on("end", async () => {
        try {
          const now = Date.now();
          const data = JSON.parse(body);

          const stats = {
            actuationCount: data.actuationCount ?? 0,
            swarmSize: data.swarmSize ?? 0,
            edgeCpuMillis: data.edgeCpuMillis ?? 0,
            networkKbps: data.networkKbps ?? 0,
            runSeconds: (Date.now() - now) / 1000
          };

          profile.enforceBudgets(stats);

          const action = {
            id: data.actionId || `edge-action-${uuidv4()}`,
            confidence: data.confidence ?? 0,
            drift: data.drift ?? 1
          };
          const classification = profile.classifyAction(action);

          if (classification.tier === "quarantine") {
            logger.warn(
              { classification, stats },
              "Quarantining high-risk edge action; requires human decision"
            );
          }

          const citizenId = data.citizenId || null;
          const inputsSummary = {
            source: "jetson-edge-agent",
            jetsonFamily: JETSON_FAMILY,
            jetsonPowerMode: JETSON_POWER_MODE
          };
          const metrics = { ...stats, classificationTier: classification.tier };
          const outputsSummary = {
            suggestedAction: classification.tier,
            flags: classification.flags
          };

          const context = {
            intent: data.intent || "edge-monitoring",
            mode: "edge-jetson",
            cyberkubeVersion: "0.1.0",
            did: data.did || null,
            walletAddress: data.walletAddress || null,
            bostromAddress: process.env.BOSTROM_ADDRESS || null,
            risksNoted: [],
            assumptions: [],
            notes: [`JETSON_FAMILY=${JETSON_FAMILY}`, `JETSON_POWER_MODE=${JETSON_POWER_MODE}`]
          };

          const runId = data.runId || uuidv4();
          const envelope = createCitizenRunEnvelope(
            runId,
            citizenId,
            profile,
            inputsSummary,
            metrics,
            outputsSummary,
            context
          );

          await postEnvelope(envelope);

          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ runId, classification }));
        } catch (err) {
          logger.error({ err }, "Error handling /telemetry");
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "bad-request" }));
        }
      });
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not-found" }));
  });

  const port = Number.parseInt(process.env.PORT || "8084", 10);
  server.listen(port, () => {
    logger.info({ port }, "JetsonEdgeAgent listening");
  });
}

function main() {
  requireHumanIntegratedMode();

  const budgets = computeLocalBudgets();
  const profile = new CyberKubeSafetyProfile({
    profileName: "ck-jetson-edge",
    maxActuationPerSecond: budgets.maxActuationPerSecond,
    maxEdgeCpuMillis: budgets.maxEdgeCpuMillis,
    maxNetworkKbps: budgets.maxNetworkKbps,
    maxSwarmSize: 256,
    context: {
      role: "augmented-citizen",
      deviceClass: `jetson-${JETSON_FAMILY}`,
      networkTrust: "edge-unknown",
      consentLevel: "minimal",
      locationHint: null
    }
  });

  logger.info(
    { JETSON_FAMILY, JETSON_POWER_MODE, budgets },
    "Starting JetsonEdgeAgent with computed budgets"
  );
  startHttpServer(profile);
}

if (import.meta.url === `file://${__filename}`) {
  main();
}
