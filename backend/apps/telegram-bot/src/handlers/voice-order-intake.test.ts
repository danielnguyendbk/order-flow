import { describe, expect, it, vi } from "vitest";

import { CommandVoiceOrderIntake } from "./voice-order-intake.js";

describe("CommandVoiceOrderIntake", () => {
  it("downloads Telegram audio and passes only a local file path to the bridge command", async () => {
    const fetchAudio = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const runCommand = vi.fn().mockImplementation(async (_command: string, args: string[]) => {
      const audioIndex = args.indexOf("--audio-file");
      expect(audioIndex).toBeGreaterThanOrEqual(0);
      expect(args[audioIndex + 1]).not.toContain("api.telegram.org");
      expect(args).not.toContain("https://api.telegram.org/file/bot-secret/voice.ogg");
      return { stdout: '{"ok":true,"transcript":"một cà phê sữa"}\n', stderr: "" };
    });
    const intake = new CommandVoiceOrderIntake(
      {
        executable: "/usr/bin/python3",
        scriptPath: "/opt/order-flow/voice_order_bridge.py",
        timeoutMs: 10_000,
      },
      { fetchAudio, runCommand },
    );

    const result = await intake.createDraftFromVoice({
      audioUrl: "https://api.telegram.org/file/bot-secret/voice.ogg",
      telegramUserId: 7377655343,
    });

    expect(result.transcript).toBe("một cà phê sữa");
    expect(runCommand).toHaveBeenCalledOnce();
  });

  it("fails closed when the bridge does not confirm that a draft was created", async () => {
    const intake = new CommandVoiceOrderIntake(
      {
        executable: "/usr/bin/python3",
        scriptPath: "/opt/order-flow/voice_order_bridge.py",
        timeoutMs: 10_000,
      },
      {
        fetchAudio: vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 })),
        runCommand: vi.fn().mockResolvedValue({ stdout: '{"ok":false,"error":"NO_DRAFT"}\n', stderr: "" }),
      },
    );

    await expect(intake.createDraftFromVoice({
      audioUrl: "https://api.telegram.org/file/bot-secret/voice.ogg",
      telegramUserId: 7377655343,
    })).rejects.toThrow("NO_DRAFT");
  });
});
