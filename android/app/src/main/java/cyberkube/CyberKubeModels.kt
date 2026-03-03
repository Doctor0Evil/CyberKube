package cyberkube

data class EcoVector(
    val joulesStep: Double,
    val gco2ePerJoule: Double,
    val ecoImpactScore: Double,
    val energyAutonomyPct: Double,
)

enum class MobilityKind { STATIC, MOBILE, EDGE_GW, XR_RIG }
enum class PlatformKind { RUST_EDGE, KOTLIN_ANDROID, JS_GATEWAY, MCU_SWARM }
enum class PatternKind { NEURO_SWARM, AI_CHAT_TUNNEL, PROM_NODE, XR_FIELD_RIG }
enum class Topology { STAR, MESH, RING, HYBRID }
enum class MobilityScope { ON_BODY, LOCAL_CELL, REGIONAL_MESH }

data class CyberKubeNodeId(
    val hostDid: String,
    val kubeKey: String,
    val region: String,
    val mobilityKind: MobilityKind,
    val platformKind: PlatformKind,
)

data class CyberKubePattern(
    val patternId: String,
    val kind: PatternKind,
    val topology: Topology,
    val hopBudget: Int,
    val jitterMaxMs: Long,
    val energyProfile: EcoVector,
    val safetyTag: String,
    val mobilityScope: MobilityScope,
)

data class CyberKubeBinding(
    val node: CyberKubeNodeId,
    val pattern: CyberKubePattern,
    val topics: List<String>,
    val rowRef: String,
    val rpmRef: String,
    val active: Boolean,
)

class CyberKubeMobileGuard(
    private val maxJoulesStep: Double,
    private val maxGco2ePerJoule: Double,
    private val maxHops: Int,
    private val maxJitterMs: Long,
) {
    fun mayRoute(binding: CyberKubeBinding): Boolean {
        val eco = binding.pattern.energyProfile
        if (eco.joulesStep > maxJoulesStep) return false
        if (eco.gco2ePerJoule > maxGco2ePerJoule) return false
        if (binding.pattern.hopBudget > maxHops) return false
        if (binding.pattern.jitterMaxMs > maxJitterMs) return false
        return true
    }
}
