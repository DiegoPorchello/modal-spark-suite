"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { X, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface CriticalErrorInfo {
  message: string;
  source: string;
  originalError: string;
  timestamp: string;
}

interface CriticalErrorModalProps {
  error: CriticalErrorInfo | null;
  onRetry: () => Promise<void>;
  onClose: () => void;
  isRetrying?: boolean;
}

export function CriticalErrorModal({
  error,
  onRetry,
  onClose,
  isRetrying = false,
}: CriticalErrorModalProps) {
  if (!error) return null;

  const handleRetry = async () => {
    await onRetry();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <AlertDialogPrimitive.Root open={true} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
            "border-destructive/50 bg-destructive/5",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <AlertDialogPrimitive.Title className="text-lg font-semibold text-destructive">
                Robô Parado — Falha de Autenticação
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="text-sm text-muted-foreground mt-1">
                Falha crítica de autenticação com a Puma Broker. O robô foi parado automaticamente
                para evitar operações sem dados reais.
              </AlertDialogPrimitive.Description>
            </div>
          </div>

          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Origem:</span>
                <code className="font-mono text-xs break-all">{error.source}</code>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Erro:</span>
                <code className="font-mono text-xs break-all text-destructive">
                  {error.originalError}
                </code>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Hora:</span>
                <span className="font-mono text-xs">{error.timestamp}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-2">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")}
            >
              {isRetrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reconectando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tentar Reconectar
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
            >
              <X className="mr-2 h-4 w-4" />
              Fechar
            </button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
