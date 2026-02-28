# CyberKube Jetson Edge Guide (Phoenix Deployments)

This document describes how to deploy CyberKube on Jetson-class edge nodes in Phoenix, with power-aware node labels, SoC-based safety budgets, and neighborhood- or clinic-specific safety profiles.

It assumes:

- A Kubernetes cluster with Jetson nodes joined as edge workers (arm64).
- CyberKube core services deployed in the `cyberkube` namespace.
- The JetsonEdgeAgent DaemonSet applied from `infra/jetson/edge-node-daemonset.yaml`.

---

## 1. Labeling Jetson Edge Nodes

CyberKube uses Kubernetes node labels to recognize Jetson edge nodes and to encode hardware and power characteristics.

For each Jetson node:

```bash
# Base edge role and architecture
kubectl label node <NODE_NAME> \
  kubernetes.io/arch=arm64 \
  cyberkube/edge-class=jetson \
  node-role.kubernetes.io/edge=

# Jetson family (examples: nano, tx2, xavier-nx, orin-nano, orin-nx, agx-orin)
kubectl label node <NODE_NAME> jetson/family=orin-nano

# Power mode label (e.g., 7W, 10W, 15W, 25W)
kubectl label node <NODE_NAME> jetson/power-mode=10W
