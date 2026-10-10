import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 180;

/** Tap-to-record → stop → transcript handed back for editing. Never records without a tap; nothing is auto-applied. */
export function Dictation({ onTranscript, label = "Record instead", className }: { onTranscript: (text: string) => void; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => { if (state === "recording" && secs >= MAX_SECONDS) stop(); }, [secs, state]);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Recording isn't supported in this browser. Please type instead."); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError("Microphone access was blocked. You can allow it in your browser settings, or type instead."); return; }
    const r = new MediaRecorder(stream);
    chunks.current = []; cancelled.current = false;
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      if (cancelled.current) { setState("idle"); return; }
      void upload(new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
    };
    rec.current = r; r.start(); setSecs(0); setState("recording");
    timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };
  const stop = () => { if (rec.current?.state === "recording") rec.current.stop(); };
  const cancel = () => { cancelled.current = true; stop(); };

  const upload = async (blob: Blob) => {
    if (blob.size < 1500) { setState("idle"); setError("That recording was too short. Try again, or type instead."); return; }
    setAudioUrl(URL.createObjectURL(blob));
    setState("transcribing");
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      form.append("file", new File([blob], `recording.${ext}`, { type: blob.type.split(";")[0] ?? "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error || "Transcription failed. You can type instead.");
      onTranscript(data.text);
    } catch (e) { setError(e instanceof Error ? e.message : "Transcription failed. You can type instead."); }
    finally { setState("idle"); }
  };

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {state === "idle" && <Button type="button" variant="outline" onClick={start} className="min-h-11 rounded-full text-sm">{audioUrl ? <><RotateCcw /> Record again</> : <><Mic /> {label}</>}</Button>}
        {state === "recording" && <>
          <Button type="button" onClick={stop} className="min-h-11 rounded-full text-sm"><Square /> Stop · {mmss}</Button>
          <Button type="button" variant="ghost" onClick={cancel} className="min-h-11 text-sm"><X /> Cancel</Button>
          <span role="status" className="text-sm text-muted-foreground">Recording… (max {MAX_SECONDS / 60} min)</span>
        </>}
        {state === "transcribing" && <span role="status" className="text-sm text-muted-foreground">Turning your recording into text…</span>}
      </div>
      {audioUrl && state === "idle" && <audio controls src={audioUrl} className="h-10 w-full max-w-sm" aria-label="Play back your recording" />}
      {error && <p role="alert" className="text-sm text-attention-foreground">{error}</p>}
    </div>
  );
}
