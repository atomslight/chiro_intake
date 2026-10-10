import { createFileRoute } from "@tanstack/react-router";
import { groqTranscribe, AiError } from "@/lib/ai/providers.server";

const MAX_BYTES = 8 * 1024 * 1024; // ~ several minutes of compressed speech

/** Audio → text. Audio is passed straight to the provider and never stored. */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES + 10_000) return Response.json({ error: "That recording is too long. Please keep it under about 3 minutes." }, { status: 413 });
        let form: FormData;
        try { form = await request.formData(); } catch { return Response.json({ error: "No recording received." }, { status: 400 }); }
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No recording received." }, { status: 400 });
        if (file.size > MAX_BYTES) return Response.json({ error: "That recording is too long. Please keep it under about 3 minutes." }, { status: 413 });
        if (!/^audio\/|^video\/webm/.test(file.type)) return Response.json({ error: "That file isn't an audio recording." }, { status: 415 });
        try {
          const text = await groqTranscribe(file);
          if (!text) return Response.json({ error: "We couldn't hear any speech. Try again closer to the microphone, or type instead." }, { status: 422 });
          return Response.json({ text });
        } catch (e) {
          return Response.json({ error: e instanceof AiError ? e.message : "Transcription failed. You can type instead." }, { status: 502 });
        }
      },
    },
  },
});
