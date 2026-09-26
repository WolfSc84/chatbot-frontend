/**
 * Tiny native i18n for the assistant widget chrome (EN/ES). No library, no
 * runtime deps: a flat dictionary + a `t()` helper. The UI language is a single
 * source of truth on the AssistantContext (`uiLang`); this only maps keys to
 * their translated strings. Backend message-text language auto-detection is a
 * separate concern — this covers static widget labels only.
 */
export type Lang = "en" | "es";

const STRINGS: Record<string, { en: string; es: string }> = {
  // Panel chrome
  "panel.title": { en: "Assistant", es: "Asistente" },
  "panel.dashboard": { en: "Dashboard", es: "Panel" },
  "panel.dashboardTitle": {
    en: "Dashboard — support ticket status",
    es: "Panel — estado de los tickets de soporte",
  },
  "panel.history": { en: "Chat history", es: "Historial de chat" },
  "panel.signOut": { en: "Sign out", es: "Cerrar sesión" },
  "panel.theme": { en: "Toggle dark mode", es: "Cambiar modo oscuro" },
  "panel.export": { en: "Export conversation", es: "Exportar conversación" },
  "panel.share": {
    en: "Share conversation by email",
    es: "Compartir conversación por correo",
  },
  "panel.responding": { en: "Responding…", es: "Respondiendo…" },
  "panel.ready": { en: "Ready", es: "Listo" },
  "panel.homeTitle": {
    en: "How can I help today?",
    es: "¿En qué puedo ayudarte hoy?",
  },
  "panel.homeSubtitle": {
    en: "Choose an area for suggested prompts, or just start typing below.",
    es: "Elige un área para ver sugerencias, o simplemente empieza a escribir abajo.",
  },
  "panel.newChat": { en: "New Chat", es: "Nuevo chat" },
  "panel.chatHistory": { en: "Chat History", es: "Historial de chat" },
  "panel.disclaimer": {
    en: "the support tool can make mistakes — verify policy details before client use.",
    es: "la herramienta de soporte puede cometer errores — verifica los detalles antes de usarla con clientes.",
  },

  // Input row
  "input.placeholder": {
    en: "Ask the assistant anything...",
    es: "Pregúntale lo que quieras al asistente...",
  },
  "input.product": { en: "Product (required)", es: "Producto (obligatorio)" },
  "input.selectTenant": { en: "Select tenant", es: "Seleccionar producto" },
  "input.selectTenantOption": {
    en: "Select tenant…",
    es: "Selecciona un producto…",
  },
  "input.loadingTenants": { en: "Loading tenants…", es: "Cargando productos…" },
  "input.grammarEnable": {
    en: "Enable grammar check",
    es: "Activar corrección gramatical",
  },
  "input.grammarDisable": {
    en: "Disable grammar check",
    es: "Desactivar corrección gramatical",
  },
  "input.grammarOnTitle": {
    en: "Grammar check: on (click to disable)",
    es: "Corrección gramatical: activada (clic para desactivar)",
  },
  "input.grammarOffTitle": {
    en: "Grammar check: off (click to enable)",
    es: "Corrección gramatical: desactivada (clic para activar)",
  },
  // Live voice (realtime duplex) — the third input mode
  "input.liveStart": { en: "Start live voice", es: "Iniciar voz en vivo" },
  "input.liveStop": { en: "End live voice", es: "Finalizar voz en vivo" },
  "input.liveStartTitle": {
    en: "Talk to the assistant hands-free",
    es: "Habla con el asistente sin usar las manos",
  },
  "input.liveStopTitle": { en: "Hang up", es: "Colgar" },
  // Live-voice mic mute — the push-to-talk button doubles as the mute toggle
  "input.liveMute": { en: "Mute microphone", es: "Silenciar micrófono" },
  "input.liveUnmute": { en: "Unmute microphone", es: "Activar micrófono" },
  "input.liveMuteTitle": {
    en: "Muted — tap to talk",
    es: "Silenciado: toca para hablar",
  },
  "input.liveUnmuteTitle": {
    en: "Live — tap to mute",
    es: "En vivo: toca para silenciar",
  },
  "input.liveOff": {
    en: "Live voice is turned off. Push-to-talk is still available.",
    es: "La voz en vivo está desactivada. Aún puedes usar pulsar para hablar.",
  },
  "input.liveUnsupported": {
    en: "This browser cannot do live voice. Use push-to-talk instead.",
    es: "Este navegador no admite voz en vivo. Usa pulsar para hablar.",
  },
  "input.liveDenied": {
    en: "Microphone access was denied. Enable it or use push-to-talk.",
    es: "Se denegó el acceso al micrófono. Actívalo o usa pulsar para hablar.",
  },
  "input.liveFailed": {
    en: "Could not start live voice.",
    es: "No se pudo iniciar la voz en vivo.",
  },
  "input.liveConnecting": { en: "Connecting…", es: "Conectando…" },
  "input.liveListening": { en: "Listening…", es: "Escuchando…" },
  // Live voice opens MUTED (tap to talk), so the status must say so. Showing
  // "Listening…" while the mic gate is shut told users the assistant could hear
  // them when it could not: the session sat idle and closed after 60s with no
  // transcript and no answer, which reads as the product being broken.
  "input.liveMuted": {
    en: "Muted — tap the mic to talk",
    es: "Silenciado: toca el micrófono para hablar",
  },
  // Open, unmuted, and nobody talking. "Listening…" was shown here, which claims
  // the assistant is hearing something when there is nothing to hear — the same
  // class of lie input.liveMuted exists to avoid.
  "input.liveWaiting": {
    en: "Waiting for you to speak",
    es: "Esperando a que hables",
  },
  // A dropped or idled-out call. Deliberately not phrased as an error: the socket
  // closing is normal (the idle timer exists so an untouched call stops costing
  // money), the conversation survives it, and tapping the phone button reopens the
  // same thread. It used to read "Live voice disconnected." in red, with no way back.
  "input.liveResumable": {
    en: "Live voice paused — tap the phone button to resume",
    es: "Voz en vivo en pausa: toca el botón de teléfono para reanudar",
  },
  "input.liveThinking": { en: "Thinking…", es: "Pensando…" },
  "input.liveSpeaking": { en: "Speaking…", es: "Hablando…" },
  "input.voiceStart": {
    en: "Start voice recording",
    es: "Iniciar grabación de voz",
  },
  "input.voiceStop": {
    en: "Stop voice recording",
    es: "Detener grabación de voz",
  },
  "input.voiceStartTitle": {
    en: "Start voice input",
    es: "Iniciar entrada de voz",
  },
  "input.voiceStopTitle": { en: "Stop recording", es: "Detener grabación" },
  "input.voiceLang": {
    en: "Voice input language",
    es: "Idioma de entrada de voz",
  },
  "input.uiLang": { en: "Interface language", es: "Idioma de la interfaz" },
  "input.send": { en: "Send message", es: "Enviar mensaje" },
  "input.sessionExpired": {
    en: "Session expired — reload to sign in.",
    es: "Sesión expirada — recarga la página para iniciar sesión.",
  },
  "input.signIn": { en: "Sign in", es: "Iniciar sesión" },
  "input.statusCorrecting": {
    en: "Correcting grammar…",
    es: "Corrigiendo gramática…",
  },
  "input.statusListening": {
    en: "Listening… click stop when done.",
    es: "Escuchando… haz clic en detener al terminar.",
  },
  "input.statusRecording": {
    en: "Recording… click stop when done.",
    es: "Grabando… haz clic en detener al terminar.",
  },
  "input.statusTranscribing": { en: "Transcribing…", es: "Transcribiendo…" },
  "input.attach": { en: "Attach a file", es: "Adjuntar un archivo" },
  "input.attachTitle": {
    en: "Attach a file for this conversation",
    es: "Adjuntar un archivo para esta conversación",
  },
  "input.statusAttaching": { en: "Attaching file…", es: "Adjuntando archivo…" },
  "input.attachDone": { en: "Attached: {name}", es: "Adjuntado: {name}" },
  "input.attachFailed": {
    en: "File attachment failed.",
    es: "No se pudo adjuntar el archivo.",
  },
  "input.voiceActive": {
    en: "Browser recognition active — speak now.",
    es: "Reconocimiento del navegador activo — habla ahora.",
  },
  "input.voiceNoSpeech": {
    en: "No speech detected — click mic to try again.",
    es: "No se detectó voz — haz clic en el micrófono para intentarlo de nuevo.",
  },

  // Chat view (audio controls / typing)
  // Speaker attribution. Shown as text beside each message's icon so the speaker
  // is identifiable without relying on colour or alignment — which carry nothing
  // when the transcript is exported, copied, or read by a screen reader.
  "chat.speakerYou": { en: "You", es: "Tú" },
  "chat.speakerAssistant": { en: "Assistant", es: "Asistente" },
  "chat.typing": {
    en: "Assistant is responding",
    es: "El asistente está respondiendo",
  },
  "chat.listen": { en: "Listen", es: "Escuchar" },
  "chat.stopAudio": { en: "Stop audio", es: "Detener audio" },
  "chat.loading": { en: "Loading…", es: "Cargando…" },
  "chat.playing": { en: "Playing…", es: "Reproduciendo…" },
  "chat.stop": { en: "Stop", es: "Detener" },
  "chat.downloadReport": { en: "Download report:", es: "Descargar informe:" },
  "chat.reportFailed": {
    en: "Report download failed.",
    es: "No se pudo descargar el informe.",
  },
};

/** Translate `key` for `lang`, falling back to English, then the key itself. */
export function t(lang: Lang, key: string): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en ?? key;
}
