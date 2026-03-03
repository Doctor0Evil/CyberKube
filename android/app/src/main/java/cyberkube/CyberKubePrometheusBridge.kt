package cyberkube

class CyberKubePrometheusBridge(
    private val guard: CyberKubeMobileGuard,
    private val sendBindingFn: suspend (CyberKubeBinding) -> Boolean,
) {
    suspend fun attachToPrometheusNode(binding: CyberKubeBinding): Boolean {
        if (!guard.mayRoute(binding)) return false
        // Push binding to Rust gateway / ROW endpoint; only then start metrics stream.
        return sendBindingFn(binding)
    }
}
