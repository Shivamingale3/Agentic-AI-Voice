import { spawn, type ChildProcess } from "node:child_process";

const COMMON = ["--raw", "--format=s16le", "--channels=1"];

/** Capture mic as 16kHz 16-bit mono PCM chunks via PulseAudio/PipeWire. */
export function startMic(onChunk: (pcm: Buffer) => void): ChildProcess {
  const proc = spawn(
    "parecord",
    [...COMMON, "--rate=16000", "--latency-msec=20"],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  proc.stdout!.on("data", onChunk);
  return proc;
}

/** Speaker playback of 24kHz 16-bit mono PCM. Supports instant flush on interruption. */
export class Speaker {
  private proc: ChildProcess | undefined;

  private ensure(): ChildProcess {
    if (!this.proc) {
      this.proc = spawn(
        "pacat",
        ["--playback", ...COMMON, "--rate=24000", "--latency-msec=50"],
        { stdio: ["pipe", "ignore", "inherit"] },
      );
      this.proc.stdin!.on("error", () => {});
    }
    return this.proc;
  }

  play(pcm: Buffer): void {
    this.ensure().stdin!.write(pcm);
  }

  /** Drop any queued audio (user barge-in). */
  flush(): void {
    this.proc?.kill("SIGKILL");
    this.proc = undefined;
  }

  close(): void {
    this.flush();
  }
}
