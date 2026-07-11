/**
 * flow-continuity/index.ts
 * Módulo Fluxo de Continuidade PRO — entrada principal
 *
 * Responsabilidade: Barrel público do módulo. Exporta apenas o que
 * deve ser consumido externamente (pelo layout principal, outras features, etc.).
 *
 * O módulo segue o padrão de "feature folder" com camadas internas:
 *
 *   types/       → Interfaces e tipos (única dependência externa: não tem)
 *   engine/      → Motor de Score
 *   catalog/     → Catálogo de Padrões
 *   ranking/     → Ranking de Ativos
 *   analysis/    → Análise do Robô
 *   executor/    → Executor de Operações
 *   broker/      → Integração com Broker
 *   calculator/  → Calculadora Sorosgale
 *   services/    → Serviços de orquestração
 *   hooks/       → Custom hooks React
 *   components/  → Componentes de UI do módulo
 *   pages/       → Páginas completas do módulo
 *   utils/       → Funções utilitárias puras
 *
 * Regras do módulo:
 *   - Dependências internas: imports apenas entre submódulos (via index.ts)
 *   - Dependências externas permitidas: React, tipos base, UI kit (components/ui)
 *   - Proibido: importar diretamente de routes/ ou de outros módulos
 */

export {};
