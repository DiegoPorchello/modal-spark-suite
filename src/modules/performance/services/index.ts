/**
 * performance/services/index.ts
 * Barrel público do submódulo de serviços do Performance Intelligence.
 *
 * Exporta o motor puro que consome os três Contexts
 * e produz o PerformanceContext.
 */

export { buildPerformanceContext, computeRobotHealthScore, buildSnapshot } from "./performance-engine";
export { performanceHistory } from "./performance-history";
