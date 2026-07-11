/**
 * modules/analyst/VoiceEngine.ts
 * Motor de voz NEXOR AI com ElevenLabs API.
 * Narra em tempo real o que o copiloto está fazendo.
 */

const ELEVENLABS_API = "https://api.elevenlabs.io/v1/text-to-speech";

const NARRATION_PHRASES: Record<string, string[]> = {
  "robot.started": ["Sessão iniciada. Motor financeiro Smart Recovery ativo."],
  "robot.stopped": ["Sessão finalizada. Todos os processos encerrados."],
  "robot.paused": ["Robô pausado. Aguardando retomada."],
  "robot.resumed": ["Sessão retomada. Escaneando mercado."],
  "analysis.started": ["Iniciando análise de mercado.", "Escaneando estrutura de velas."],
  "analysis.no-signal": ["Nenhum padrão confirmado. Aguardando próxima vela."],
  "analysis.completed": ["Análise concluída."],
  "scanner.started": ["Scanner iniciado. Procurando padrões."],
  "scanner.completed": ["Escaneamento finalizado."],
  "pattern.2greens": ["Dois candles verdes consecutivos. Continuidade de alta confirmada."],
  "pattern.2reds": ["Dois candles vermelhos consecutivos. Continuidade de baixa confirmada."],
  "pattern.broken": ["Padrão quebrado. Resetando leitura."],
  "trade.call": ["Entrada CALL executada.", "Ordem de compra enviada."],
  "trade.put": ["Entrada PUT executada.", "Ordem de venda enviada."],
  "trade.win": ["WIN confirmado! Lucro registrado. Continuidade preservada."],
  "trade.loss": ["LOSS registrado. Padrão quebrado. Nova leitura iniciada."],
  "trade.draw": ["Resultado indefinido. Reiniciando análise."],
  "order.confirmed": ["Ordem confirmada pelo broker."],
  "order.error": ["Erro ao enviar ordem. Verificando conexão."],
  "recovery.step": ["Modo recovery ativo. Calculando nova stake."],
  "risk.stop-loss": ["Stop loss atingido. Sessão encerrada."],
  "risk.profit-target": ["Meta de lucro atingida. Sessão encerrada."],
  "risk.insufficient-balance": ["Saldo insuficiente. Robô parado."],
  "risk.ai-pause": ["Atenção. Pausa inteligente ativada. Protegendo capital."],
  "candle.new": ["Nova vela recebida. Atualizando leitura."],
  "candle.green": ["Vela verde detectada. Pressão compradora."],
  "candle.red": ["Vela vermelha detectada. Pressão vendedora."],
  "catalog.search": ["Buscando padrão no catálogo."],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/R\$\s*([\d.]+),(\d{2})/g, (_m, intPart, decPart) => {
      const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " vírgula " + decPart;
      return formatted + " reais";
    })
    .replace(/([\d.]+),(\d{2})%/g, (_m, num, dec) => {
      return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " vírgula " + dec + " por cento";
    });
}

export class VoiceEngine {
  private _enabled = false;
  private _volume = 0.85;
  private _rate = 1.0;
  private _lastSpokenId = "";
  private _queue: { text: string; resolve: () => void }[] = [];
  private _speaking = false;
  private _apiKey = "";
  private _voiceId = "JBFqnCBsd6RMkjVDRZzb";
  private _modelId = "eleven_multilingual_v2";
  private _currentAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this._apiKey = (import.meta as any).env?.VITE_ELELABS_API_KEY ?? "";
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(val: boolean) {
    this._enabled = val;
    if (!val) this.stop();
  }

  get volume(): number {
    return this._volume;
  }

  set volume(val: number) {
    this._volume = Math.max(0, Math.min(1, val));
    if (this._currentAudio) this._currentAudio.volume = this._volume;
  }

  get rate(): number {
    return this._rate;
  }

  set rate(val: number) {
    this._rate = Math.max(0.5, Math.min(2.0, val));
  }

  setVoice(voiceId: string): void {
    this._voiceId = voiceId;
  }

  get isAvailable(): boolean {
    return typeof window !== "undefined" && !!this._apiKey;
  }

  speak(text: string, priority: boolean = false): void {
    if (!this._enabled || !this._apiKey) return;

    if (priority) {
      this.stop();
    }

    this._queue.push({ text, resolve: () => {} });
    this._processQueue();
  }

  speakEvent(eventType: string, meta?: Record<string, unknown>): void {
    if (!this._enabled) return;

    const phrases = NARRATION_PHRASES[eventType];
    if (phrases && phrases.length > 0) {
      this.speak(pick(phrases), true);
      return;
    }

    if (meta?.text && typeof meta.text === "string") {
      this.speak(meta.text);
    }
  }

  speakDiary(entry: { id: string; text: string; icon: string; level: string }): void {
    if (!this._enabled) return;
    if (entry.id === this._lastSpokenId) return;

    this._lastSpokenId = entry.id;
    const cleaned = cleanTextForSpeech(entry.text);
    this.speak(cleaned, true);
  }

  private async _processQueue(): Promise<void> {
    if (this._speaking || this._queue.length === 0) return;

    this._speaking = true;
    const { text } = this._queue.shift()!;

    try {
      await this._fetchAndPlay(text);
    } catch (err) {
      console.warn("[NEXOR Voice] ElevenLabs API error:", err);
    } finally {
      this._speaking = false;
      this._processQueue();
    }
  }

  private async _fetchAndPlay(text: string): Promise<void> {
    const url = `${ELEVENLABS_API}/${this._voiceId}?output_format=mp3_44100_96&optimize_streaming_latency=3`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this._apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: this._modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          speed: this._rate,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`ElevenLabs ${response.status}: ${errText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(audioUrl);
      this._currentAudio = audio;
      audio.volume = this._volume;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this._currentAudio = null;
        resolve();
      };

      audio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl);
        this._currentAudio = null;
        reject(e);
      };

      audio.play().catch(reject);
    });
  }

  stop(): void {
    if (this._currentAudio) {
      this._currentAudio.pause();
      this._currentAudio.currentTime = 0;
      this._currentAudio = null;
    }
    this._queue = [];
    this._speaking = false;
  }

  destroy(): void {
    this.stop();
  }
}

let _instance: VoiceEngine | null = null;

export function getVoiceEngine(): VoiceEngine {
  if (!_instance) {
    _instance = new VoiceEngine();
  }
  return _instance;
}
