/**
 * Tiny native i18n for the assistant widget chrome (EN/ES). No library, no
 * runtime deps: a flat dictionary + a `t()` helper. The UI language is a single
 * source of truth on the AssistantContext (`uiLang`); this only maps keys to
 * their translated strings. Backend message-text language auto-detection is a
 * separate concern — this covers static widget labels only.
 */
export type Lang = 'en' | 'es';

const STRINGS: Record<string, { en: string; es: string }> = {
  // Panel chrome
  'panel.title': { en: 'Assistant', es: 'Asistente' },
  'panel.dashboard': { en: 'Dashboard', es: 'Panel' },
  'panel.dashboardTitle': {
    en: 'Dashboard — support ticket status',
    es: 'Panel — estado de los tickets de soporte',
  },
  'panel.history': { en: 'Chat history', es: 'Historial de chat' },
  'panel.signOut': { en: 'Sign out', es: 'Cerrar sesión' },
  'panel.export': { en: 'Export conversation', es: 'Exportar conversación' },
  'panel.share': { en: 'Share conversation by email', es: 'Compartir conversación por correo' },
  'panel.responding': { en: 'Responding…', es: 'Respondiendo…' },
  'panel.ready': { en: 'Ready', es: 'Listo' },
  'panel.homeTitle': { en: 'How can I help today?', es: '¿En qué puedo ayudarte hoy?' },
  'panel.homeSubtitle': {
    en: 'Choose an area for suggested prompts, or just start typing below.',
    es: 'Elige un área para ver sugerencias, o simplemente empieza a escribir abajo.',
  },
  'panel.newChat': { en: 'New Chat', es: 'Nuevo chat' },
  'panel.chatHistory': { en: 'Chat History', es: 'Historial de chat' },
  'panel.disclaimer': {
    en: 'the support tool can make mistakes — verify policy details before client use.',
    es: 'la herramienta de soporte puede cometer errores — verifica los detalles antes de usarla con clientes.',
  },

  // Input row
  'input.placeholder': {
    en: 'Ask the assistant anything...',
    es: 'Pregúntale lo que quieras al asistente...',
  },
  'input.product': { en: 'Product (required)', es: 'Producto (obligatorio)' },
  'input.selectTenant': { en: 'Select tenant', es: 'Seleccionar producto' },
  'input.selectTenantOption': { en: 'Select tenant…', es: 'Selecciona un producto…' },
  'input.grammarEnable': { en: 'Enable grammar check', es: 'Activar corrección gramatical' },
  'input.grammarDisable': { en: 'Disable grammar check', es: 'Desactivar corrección gramatical' },
  'input.grammarOnTitle': {
    en: 'Grammar check: on (click to disable)',
    es: 'Corrección gramatical: activada (clic para desactivar)',
  },
  'input.grammarOffTitle': {
    en: 'Grammar check: off (click to enable)',
    es: 'Corrección gramatical: desactivada (clic para activar)',
  },
  'input.voiceStart': { en: 'Start voice recording', es: 'Iniciar grabación de voz' },
  'input.voiceStop': { en: 'Stop voice recording', es: 'Detener grabación de voz' },
  'input.voiceStartTitle': { en: 'Start voice input', es: 'Iniciar entrada de voz' },
  'input.voiceStopTitle': { en: 'Stop recording', es: 'Detener grabación' },
  'input.voiceLang': { en: 'Voice input language', es: 'Idioma de entrada de voz' },
  'input.uiLang': { en: 'Interface language', es: 'Idioma de la interfaz' },
  'input.send': { en: 'Send message', es: 'Enviar mensaje' },
  'input.sessionExpired': {
    en: 'Session expired — reload to sign in.',
    es: 'Sesión expirada — recarga la página para iniciar sesión.',
  },
  'input.signIn': { en: 'Sign in', es: 'Iniciar sesión' },
  'input.statusCorrecting': { en: 'Correcting grammar…', es: 'Corrigiendo gramática…' },
  'input.statusListening': {
    en: 'Listening… click stop when done.',
    es: 'Escuchando… haz clic en detener al terminar.',
  },
  'input.statusRecording': {
    en: 'Recording… click stop when done.',
    es: 'Grabando… haz clic en detener al terminar.',
  },
  'input.statusTranscribing': { en: 'Transcribing…', es: 'Transcribiendo…' },
  'input.attach': { en: 'Attach a file', es: 'Adjuntar un archivo' },
  'input.attachTitle': {
    en: 'Attach a file for this conversation',
    es: 'Adjuntar un archivo para esta conversación',
  },
  'input.statusAttaching': { en: 'Attaching file…', es: 'Adjuntando archivo…' },
  'input.attachDone': { en: 'Attached: {name}', es: 'Adjuntado: {name}' },
  'input.attachFailed': { en: 'File attachment failed.', es: 'No se pudo adjuntar el archivo.' },
  'input.voiceActive': {
    en: 'Browser recognition active — speak now.',
    es: 'Reconocimiento del navegador activo — habla ahora.',
  },
  'input.voiceNoSpeech': {
    en: 'No speech detected — click mic to try again.',
    es: 'No se detectó voz — haz clic en el micrófono para intentarlo de nuevo.',
  },

  // Chat view (audio controls / typing)
  'chat.typing': { en: 'Assistant is responding', es: 'El asistente está respondiendo' },
  'chat.listen': { en: 'Listen', es: 'Escuchar' },
  'chat.stopAudio': { en: 'Stop audio', es: 'Detener audio' },
  'chat.loading': { en: 'Loading…', es: 'Cargando…' },
  'chat.playing': { en: 'Playing…', es: 'Reproduciendo…' },
  'chat.stop': { en: 'Stop', es: 'Detener' },
  'chat.downloadReport': { en: 'Download report:', es: 'Descargar informe:' },
  'chat.reportFailed': { en: 'Report download failed.', es: 'No se pudo descargar el informe.' },
};

/** Translate `key` for `lang`, falling back to English, then the key itself. */
export function t(lang: Lang, key: string): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en ?? key;
}
