import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { Speaker, startMic } from "./audio.js";

const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("Set GEMINI_API_KEY (e.g. in .env) and run: npm run dev");
  process.exit(1);
}

const MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
const ai = new GoogleGenAI({ apiKey });
const speaker = new Speaker();

function onMessage(msg: LiveServerMessage): void {
  const c = msg.serverContent;
  if (!c) return;

  // A single event may carry several parts; handle all of them.
  for (const part of c.modelTurn?.parts ?? []) {
    if (part.inlineData?.data) {
      speaker.play(Buffer.from(part.inlineData.data, "base64"));
    }
  }
  if (c.interrupted) speaker.flush();
  if (c.inputTranscription?.text) process.stdout.write(`\x1b[36m${c.inputTranscription.text}\x1b[0m`);
  if (c.outputTranscription?.text) process.stdout.write(c.outputTranscription.text);
  if (c.turnComplete) process.stdout.write("\n");
}

const session = await ai.live.connect({
  model: MODEL,
  config: {
    responseModalities: [Modality.AUDIO],
    systemInstruction: {
      parts: [{ text: "You are a friendly voice assistant. Keep replies short and conversational." }],
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  },
  callbacks: {
    onopen: () => console.log(`Connected to ${MODEL}. Speak now (use headphones to avoid echo). Ctrl+C to quit.`),
    onmessage: onMessage,
    onerror: (e) => console.error("Error:", e.message),
    onclose: () => {
      console.log("\nSession closed.");
      shutdown();
    },
  },
});

const mic = startMic((pcm) => {
  session.sendRealtimeInput({
    audio: { data: pcm.toString("base64"), mimeType: "audio/pcm;rate=16000" },
  });
});
mic.on("error", (e) => console.error("Mic error:", e.message));

function shutdown(): void {
  mic.kill();
  speaker.close();
  process.exit(0);
}
process.on("SIGINT", () => {
  session.close();
  shutdown();
});
