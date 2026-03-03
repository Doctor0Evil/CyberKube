use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EcoVector {
    pub joules_step: f64,
    pub gco2e_per_joule: f64,
    pub ecoimpact_score: f64,
    pub energy_autonomy_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MobilityKind {
    Static,
    Mobile,
    EdgeGw,
    XrRig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PlatformKind {
    RustEdge,
    KotlinAndroid,
    JsGateway,
    McuSwarm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CyberKubeNodeId {
    pub hostdid: String,
    pub kubekey: String,
    pub region: String,
    pub mobilitykind: MobilityKind,
    pub platformkind: PlatformKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternKind {
    NeuroSwarm,
    AiChatTunnel,
    PromNode,
    XrFieldRig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Topology {
    Star,
    Mesh,
    Ring,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MobilityScope {
    OnBody,
    LocalCell,
    RegionalMesh,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CyberKubePattern {
    pub patternid: String,
    pub kind: PatternKind,
    pub topology: Topology,
    pub hopbudget: u16,
    pub jittermax_ms: u32,
    pub energy_profile: EcoVector,
    pub safety_tag: String,
    pub mobility_scope: MobilityScope,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CyberKubeBinding {
    pub node: CyberKubeNodeId,
    pub pattern: CyberKubePattern,
    pub topics: Vec<String>,
    pub rowref: String,
    pub rpmref: String,
    pub active: bool,
}

pub trait CyberKubeGuard {
    fn may_route(&self, binding: &CyberKubeBinding) -> bool;
}

#[derive(Debug, Clone)]
pub struct DefaultCyberKubeGuard {
    pub max_joules_step: f64,
    pub max_gco2e_per_joule: f64,
    pub max_hops: u16,
    pub max_jitter_ms: u32,
}

impl CyberKubeGuard for DefaultCyberKubeGuard {
    fn may_route(&self, binding: &CyberKubeBinding) -> bool {
        let eco = &binding.pattern.energy_profile;
        if eco.joules_step > self.max_joules_step {
            return false;
        }
        if eco.gco2e_per_joule > self.max_gco2e_per_joule {
            return false;
        }
        if binding.pattern.hopbudget > self.max_hops {
            return false;
        }
        if binding.pattern.jittermax_ms > self.max_jitter_ms {
            return false;
        }
        true
    }
}

/// Example entry point a Rust node uses before wiring AI-chat tunnels or Prometheus scrapes.
pub fn register_cyberkube_binding(
    guard: &dyn CyberKubeGuard,
    binding: CyberKubeBinding,
) -> Result<CyberKubeBinding, String> {
    if !guard.may_route(&binding) {
        return Err("CyberKubeGuard denied binding under eco or QoS limits".into());
    }
    // TODO: persist to ROW/RPM shards and activate routing.
    Ok(binding)
}
