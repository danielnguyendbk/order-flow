import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { VoiceOrderIntake, VoiceOrderIntakeInput, VoiceOrderIntakeResult } from "./voice-order.handler.js";

const execFileAsync = promisify(execFile);
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export interface CommandVoiceOrderIntakeConfig {
  executable: string;
  scriptPath: string;
  timeoutMs: number;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

interface CommandVoiceOrderIntakeDependencies {
  fetchAudio: typeof fetch;
  runCommand(command: string, args: string[], options: { timeout: number; env: NodeJS.ProcessEnv }): Promise<CommandResult>;
}

const defaultDependencies: CommandVoiceOrderIntakeDependencies = {
  fetchAudio: fetch,
  runCommand: async (command, args, options) => {
    const result = await execFileAsync(command, args, {
      timeout: options.timeout,
      env: options.env,
      maxBuffer: 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  },
};

export class CommandVoiceOrderIntake implements VoiceOrderIntake {
  constructor(
    private readonly config: CommandVoiceOrderIntakeConfig,
    private readonly dependencies: CommandVoiceOrderIntakeDependencies = defaultDependencies,
  ) {}

  async createDraftFromVoice(input: VoiceOrderIntakeInput): Promise<VoiceOrderIntakeResult> {
    const audioUrl = new URL(input.audioUrl);
    if (audioUrl.protocol !== "https:" || audioUrl.hostname !== "api.telegram.org") {
      throw new Error("INVALID_TELEGRAM_AUDIO_URL");
    }

    const tempDirectory = await mkdtemp(join(tmpdir(), "order-flow-voice-"));
    const audioPath = join(tempDirectory, "voice.ogg");

    try {
      const response = await this.dependencies.fetchAudio(audioUrl);
      if (!response.ok) throw new Error(`AUDIO_DOWNLOAD_FAILED_${response.status}`);
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > MAX_AUDIO_BYTES) throw new Error("AUDIO_TOO_LARGE");
      const audio = new Uint8Array(await response.arrayBuffer());
      if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new Error(audio.length ? "AUDIO_TOO_LARGE" : "AUDIO_EMPTY");
      await writeFile(audioPath, audio, { mode: 0o600 });

      const result = await this.dependencies.runCommand(
        this.config.executable,
        [
          this.config.scriptPath,
          "--audio-file",
          audioPath,
          "--telegram-user-id",
          String(input.telegramUserId),
        ],
        { timeout: this.config.timeoutMs, env: process.env },
      );
      const outputLine = result.stdout.trim().split("\n").filter(Boolean).at(-1);
      if (!outputLine) throw new Error("VOICE_BRIDGE_EMPTY_RESPONSE");
      const payload = JSON.parse(outputLine) as { ok?: boolean; transcript?: string; error?: string };
      if (!payload.ok || !payload.transcript?.trim()) {
        throw new Error(payload.error || "VOICE_BRIDGE_DID_NOT_CREATE_DRAFT");
      }
      return { transcript: payload.transcript.trim() };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
