/**
 * calculator/index.ts
 * Calculadora Sorosgale (Sorosgale Calculator)
 *
 * Responsabilidade: Gerenciar a estratégia de gerenciamento de banca Sorosgale.
 * Define níveis de entrada progressivos, calcula valores, monitora
 * o nível ativo e controla a progressão/regressão entre níveis.
 *
 * Funções principais (a implementar):
 *   - getConfig() → SorosgaleConfig
 *   - updateConfig(config) → void
 *   - getCurrentLevel() → SorosgaleLevel
 *   - getLevels() → SorosgaleLevel[]
 *   - simulate(config) → CalculatorSimulation
 *   - onLevelChange() → Observable<LevelChangeEvent>
 *   - calculateEntries(level, bankroll) → { firstEntry, secondEntry }
 *
 * Integra-se com: executor (fornece valores de entrada), services (orquestração)
 */

export type {
  SorosgaleConfig,
  SorosgaleStrategy,
  SorosgaleLevel,
  LevelStatus,
  LiveLevelState,
  CalculatorSimulation,
  LevelChangeEvent,
} from "../types";
