import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minus, Square, Maximize2, Minimize2, GripVertical } from "lucide-react";

interface PumaBrokerModalProps {
  open: boolean;
  onClose: () => void;
}

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isMinimized: boolean;
}

const DEFAULT_STATE: WindowState = {
  x: 100,
  y: 50,
  width: 1200,
  height: 750,
  isMaximized: false,
  isMinimized: false,
};

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

export function PumaBrokerModal({ open, onClose }: PumaBrokerModalProps) {
  const [windowState, setWindowState] = useState<WindowState>(DEFAULT_STATE);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>("");
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, wx: 0, wy: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - windowState.x, y: e.clientY - windowState.y };
  }, [windowState.x, windowState.y]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setWindowState(prev => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
      isMaximized: false,
    }));
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: windowState.width,
      height: windowState.height,
      wx: windowState.x,
      wy: windowState.y,
    };
  }, [windowState]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    const { width: sw, height: sh, wx, wy } = resizeStart.current;

    let newWidth = sw;
    let newHeight = sh;
    let newX = wx;
    let newY = wy;

    if (resizeDirection.includes("e")) newWidth = Math.max(MIN_WIDTH, sw + dx);
    if (resizeDirection.includes("w")) {
      newWidth = Math.max(MIN_WIDTH, sw - dx);
      newX = wx + (sw - newWidth);
    }
    if (resizeDirection.includes("s")) newHeight = Math.max(MIN_HEIGHT, sh + dy);
    if (resizeDirection.includes("n")) {
      newHeight = Math.max(MIN_HEIGHT, sh - dy);
      newY = wy + (sh - newHeight);
    }

    setWindowState(prev => ({
      ...prev,
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY,
    }));
  }, [isResizing, resizeDirection]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection("");
  }, []);

  // Mouse events
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Reset position on open
  useEffect(() => {
    if (open) {
      setWindowState(DEFAULT_STATE);
    }
  }, [open]);

  const toggleMaximize = () => {
    setWindowState(prev => {
      if (prev.isMaximized) {
        return DEFAULT_STATE;
      }
      return {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        isMaximized: true,
        isMinimized: false,
      };
    });
  };

  const toggleMinimize = () => {
    setWindowState(prev => ({
      ...prev,
      isMinimized: !prev.isMinimized,
      isMaximized: false,
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      {!windowState.isMinimized && (
        <div
          className="absolute inset-0 bg-black/40 pointer-events-auto"
          onClick={onClose}
        />
      )}

      {/* Window */}
      <div
        ref={windowRef}
        className={`absolute pointer-events-auto flex flex-col rounded-lg border border-border shadow-2xl overflow-hidden transition-none ${
          windowState.isMinimized ? "hidden" : ""
        } ${isDragging || isResizing ? "select-none" : ""}`}
        style={{
          left: windowState.isMaximized ? 0 : windowState.x,
          top: windowState.isMaximized ? 0 : windowState.y,
          width: windowState.isMaximized ? "100vw" : windowState.width,
          height: windowState.isMaximized ? "100vh" : windowState.height,
          borderRadius: windowState.isMaximized ? 0 : undefined,
        }}
      >
        {/* Title Bar */}
        <div
          className="h-10 bg-gradient-to-r from-gray-900 to-gray-800 flex items-center justify-between px-2 cursor-move shrink-0"
          onMouseDown={handleDragStart}
          onDoubleClick={toggleMaximize}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="size-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="size-5 rounded bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white">
                P
              </div>
              <span className="text-sm font-medium text-white">Puma Broker</span>
            </div>
          </div>

          {/* Window Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMinimize}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Minimizar"
            >
              <Minus className="size-4" />
            </button>
            <button
              onClick={toggleMaximize}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title={windowState.isMaximized ? "Restaurar" : "Maximizar"}
            >
              {windowState.isMaximized ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/80 text-gray-400 hover:text-white transition-colors"
              title="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Iframe Content */}
        <div className="flex-1 bg-white">
          <iframe
            src="https://trade.pumabroker.com"
            className="w-full h-full border-0"
            title="Puma Broker"
            allow="clipboard-read; clipboard-write"
          />
        </div>

        {/* Resize Handles (only when not maximized) */}
        {!windowState.isMaximized && (
          <>
            {/* Corners */}
            <div
              className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
              onMouseDown={(e) => handleResizeStart(e, "nw")}
            />
            <div
              className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
              onMouseDown={(e) => handleResizeStart(e, "ne")}
            />
            <div
              className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
              onMouseDown={(e) => handleResizeStart(e, "sw")}
            />
            <div
              className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
              onMouseDown={(e) => handleResizeStart(e, "se")}
            />

            {/* Edges */}
            <div
              className="absolute top-0 left-3 right-3 h-2 cursor-n-resize"
              onMouseDown={(e) => handleResizeStart(e, "n")}
            />
            <div
              className="absolute bottom-0 left-3 right-3 h-2 cursor-s-resize"
              onMouseDown={(e) => handleResizeStart(e, "s")}
            />
            <div
              className="absolute left-0 top-3 bottom-3 w-2 cursor-w-resize"
              onMouseDown={(e) => handleResizeStart(e, "w")}
            />
            <div
              className="absolute right-0 top-3 bottom-3 w-2 cursor-e-resize"
              onMouseDown={(e) => handleResizeStart(e, "e")}
            />
          </>
        )}
      </div>

      {/* Minimized Taskbar */}
      {windowState.isMinimized && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto"
        >
          <button
            onClick={toggleMinimize}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg hover:bg-gray-800 transition-colors"
          >
            <div className="size-5 rounded bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white">
              P
            </div>
            <span className="text-sm text-white font-medium">Puma Broker</span>
          </button>
        </div>
      )}
    </div>
  );
}
