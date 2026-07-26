import { ShieldAlert, RotateCcw, Brain } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import type { QuarantineThresholds, ConfidenceThresholds } from "./types";

interface SettingsTabProps {
  quarantineThresholds: QuarantineThresholds;
  confidenceThresholds: ConfidenceThresholds;
  onQuarantineChange: (t: QuarantineThresholds) => void;
  onConfidenceChange: (t: ConfidenceThresholds) => void;
}

export function SettingsTab({
  quarantineThresholds,
  confidenceThresholds,
  onQuarantineChange,
  onConfidenceChange,
}: SettingsTabProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Quarentena */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-warning" />
          <span className="text-xs font-semibold">Quarentena</span>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-1">
          Ativos que atingirem os limites serão automaticamente removidos do trading.
        </p>

        <div className="flex items-center justify-between">
          <span className="text-[11px]">Quarentena Automática</span>
          <Switch
            checked={quarantineThresholds.autoQuarantineEnabled}
            onCheckedChange={(v) =>
              onQuarantineChange({ ...quarantineThresholds, autoQuarantineEnabled: v })
            }
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Win Rate Mínimo</span>
            <span className="text-[11px] font-medium">{quarantineThresholds.minWinRate}%</span>
          </div>
          <Slider
            value={[quarantineThresholds.minWinRate]}
            onValueChange={([v]) =>
              onQuarantineChange({ ...quarantineThresholds, minWinRate: v })
            }
            min={10}
            max={70}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Loss Consecutivos Máx.</span>
            <span className="text-[11px] font-medium">{quarantineThresholds.maxConsecutiveLosses}</span>
          </div>
          <Slider
            value={[quarantineThresholds.maxConsecutiveLosses]}
            onValueChange={([v]) =>
              onQuarantineChange({ ...quarantineThresholds, maxConsecutiveLosses: v })
            }
            min={2}
            max={15}
            step={1}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Confiança Mínima</span>
            <span className="text-[11px] font-medium">{quarantineThresholds.minConfidence}%</span>
          </div>
          <Slider
            value={[quarantineThresholds.minConfidence]}
            onValueChange={([v]) =>
              onQuarantineChange({ ...quarantineThresholds, minConfidence: v })
            }
            min={5}
            max={60}
            step={5}
          />
        </div>
      </div>

      {/* Reativação */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-info" />
          <span className="text-xs font-semibold">Reativação</span>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-1">
          Condições para reativar um ativo que está em quarentena.
        </p>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Win Rate para Reativar</span>
            <span className="text-[11px] font-medium">{quarantineThresholds.reactivationWinRate}%</span>
          </div>
          <Slider
            value={[quarantineThresholds.reactivationWinRate]}
            onValueChange={([v]) =>
              onQuarantineChange({ ...quarantineThresholds, reactivationWinRate: v })
            }
            min={30}
            max={70}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Confiança para Reativar</span>
            <span className="text-[11px] font-medium">{quarantineThresholds.reactivationMinConfidence}%</span>
          </div>
          <Slider
            value={[quarantineThresholds.reactivationMinConfidence]}
            onValueChange={([v]) =>
              onQuarantineChange({ ...quarantineThresholds, reactivationMinConfidence: v })
            }
            min={15}
            max={60}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Cooldown (min)</span>
            <span className="text-[11px] font-medium">{quarantineThresholds.reactivationCooldownMinutes}min</span>
          </div>
          <Slider
            value={[quarantineThresholds.reactivationCooldownMinutes]}
            onValueChange={([v]) =>
              onQuarantineChange({ ...quarantineThresholds, reactivationCooldownMinutes: v })
            }
            min={5}
            max={240}
            step={5}
          />
        </div>
      </div>

      {/* Score de Confiança */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <span className="text-xs font-semibold">Score de Confiança</span>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-1">
          Pesos utilizados no cálculo do score de confiança de cada ativo.
        </p>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Peso Win Rate</span>
            <span className="text-[11px] font-medium">{(confidenceThresholds.weightWins * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[confidenceThresholds.weightWins * 100]}
            onValueChange={([v]) => {
              const remaining = 1 - v / 100;
              const profitWeight = confidenceThresholds.weightProfit /
                (confidenceThresholds.weightProfit + confidenceThresholds.weightConsistency || 1);
              onConfidenceChange({
                ...confidenceThresholds,
                weightWins: v / 100,
                weightProfit: remaining * profitWeight,
                weightConsistency: remaining * (1 - profitWeight),
              });
            }}
            min={10}
            max={70}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Peso Lucro</span>
            <span className="text-[11px] font-medium">{(confidenceThresholds.weightProfit * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[confidenceThresholds.weightProfit * 100]}
            onValueChange={([v]) => {
              const remaining = 1 - v / 100;
              const winsWeight = confidenceThresholds.weightWins /
                (confidenceThresholds.weightWins + confidenceThresholds.weightConsistency || 1);
              onConfidenceChange({
                ...confidenceThresholds,
                weightProfit: v / 100,
                weightWins: remaining * winsWeight,
                weightConsistency: remaining * (1 - winsWeight),
              });
            }}
            min={10}
            max={70}
            step={5}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-muted-foreground">Peso Consistência</span>
            <span className="text-[11px] font-medium">{(confidenceThresholds.weightConsistency * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[confidenceThresholds.weightConsistency * 100]}
            onValueChange={([v]) => {
              const remaining = 1 - v / 100;
              const winsWeight = confidenceThresholds.weightWins /
                (confidenceThresholds.weightWins + confidenceThresholds.weightProfit || 1);
              onConfidenceChange({
                ...confidenceThresholds,
                weightConsistency: v / 100,
                weightWins: remaining * winsWeight,
                weightProfit: remaining * (1 - winsWeight),
              });
            }}
            min={5}
            max={50}
            step={5}
          />
        </div>

        <div className="flex gap-3 mt-1">
          <div className="flex-1 p-2 rounded border border-border text-center">
            <div className="text-[9px] text-muted-foreground">Mínima</div>
            <Input
              type="number"
              value={confidenceThresholds.minConfidence}
              onChange={(e) =>
                onConfidenceChange({ ...confidenceThresholds, minConfidence: Number(e.target.value) })
              }
              className="h-7 text-xs text-center mt-1"
            />
          </div>
          <div className="flex-1 p-2 rounded border border-border text-center">
            <div className="text-[9px] text-muted-foreground">Alta</div>
            <Input
              type="number"
              value={confidenceThresholds.highConfidence}
              onChange={(e) =>
                onConfidenceChange({ ...confidenceThresholds, highConfidence: Number(e.target.value) })
              }
              className="h-7 text-xs text-center mt-1"
            />
          </div>
          <div className="flex-1 p-2 rounded border border-border text-center">
            <div className="text-[9px] text-muted-foreground">Crítica</div>
            <Input
              type="number"
              value={confidenceThresholds.criticalConfidence}
              onChange={(e) =>
                onConfidenceChange({ ...confidenceThresholds, criticalConfidence: Number(e.target.value) })
              }
              className="h-7 text-xs text-center mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
