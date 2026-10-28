/**
 * User-facing signup sentences. Browser-safe: no server imports.
 * English and Spanish stay paired: same keys, same promises.
 * Success says what actually happens. There is no promised day and no automatic email.
 * `unavailable` is the answer when we could not keep the signup.
 */
const enLead = "Thanks. You’re on the list.";
const enNext =
  "We use your name and email only for updates and help resources. This signup doesn’t send an email on its own. When we have an update or a resource to share, we write from hello@helpgetup.com. There isn’t a set schedule.";
const enFoodBefore = "If you need food today, use the ";
const enFoodLabel = "Albany County food list";
const enFoodAfter = ".";

const esLead = "Gracias. Ya estás en la lista.";
const esNext =
  "Usamos tu nombre y tu correo solo para novedades y recursos de ayuda. Este registro no envía un correo por sí solo. Cuando tengamos una novedad o un recurso para compartir, escribimos desde hello@helpgetup.com. No hay un día fijo.";
const esFoodBefore = "Si necesitas comida hoy, usa la ";
const esFoodLabel = "lista de comida del condado de Albany";
const esFoodAfter = ".";

export const SIGNUP_COPY_EN = {
  okLead: enLead,
  okNext: enNext,
  okFoodBefore: enFoodBefore,
  okFoodLabel: enFoodLabel,
  okFoodAfter: enFoodAfter,
  ok: `${enLead} ${enNext} ${enFoodBefore}${enFoodLabel}${enFoodAfter}`,
  invalid: "Enter your name and an email address.",
  limited:
    "That’s enough signups from this connection for now. Email hello@helpgetup.com if you still want updates.",
  origin: "That signup has to come from helpgetup.com.",
  large: "That signup is too long. Email hello@helpgetup.com instead.",
  network: "Couldn’t reach the server. Try again, or email hello@helpgetup.com.",
  unavailable: "We couldn’t save that signup. Email hello@helpgetup.com and we’ll add you.",
  labelName: "Name",
  labelEmail: "Email",
  button: "Get updates and help resources",
  sending: "Sending…",
  note: "We use your name and email only to send updates and help resources. Questions:",
} as const;

export const SIGNUP_COPY_ES = {
  okLead: esLead,
  okNext: esNext,
  okFoodBefore: esFoodBefore,
  okFoodLabel: esFoodLabel,
  okFoodAfter: esFoodAfter,
  ok: `${esLead} ${esNext} ${esFoodBefore}${esFoodLabel}${esFoodAfter}`,
  invalid: "Escribe tu nombre y un correo electrónico.",
  limited:
    "Ya hubo bastantes registros desde esta conexión. Escribe a hello@helpgetup.com si todavía quieres novedades.",
  origin: "Ese registro tiene que venir de helpgetup.com.",
  large: "Ese registro es demasiado largo. Escribe a hello@helpgetup.com.",
  network: "No se pudo llegar al servidor. Inténtalo otra vez, o escribe a hello@helpgetup.com.",
  unavailable: "No pudimos guardar ese registro. Escribe a hello@helpgetup.com y te agregamos.",
  labelName: "Nombre",
  labelEmail: "Correo electrónico",
  button: "Recibir novedades y recursos de ayuda",
  sending: "Enviando…",
  note: "Usamos tu nombre y tu correo solo para enviar novedades y recursos de ayuda. Preguntas:",
} as const;

export type SignupCopy = {
  [K in keyof typeof SIGNUP_COPY_EN]: string;
};

/** English sentences. The no-JavaScript page and the server errors use these. */
export const SIGNUP_COPY: SignupCopy = SIGNUP_COPY_EN;

export function signupCopy(lang: "en" | "es"): SignupCopy {
  return lang === "es" ? SIGNUP_COPY_ES : SIGNUP_COPY_EN;
}

/** How long the browser waits for /api/updates before showing the network sentence. */
export const SIGNUP_CLIENT_TIMEOUT_MS = 15_000;

/**
 * Client message for a finished response.
 * 400 keeps the “enter your name and email” sentence.
 * Any other status uses the server sentence when we have one in English,
 * otherwise the matching local sentence. A 5xx never falls through to `invalid`.
 */
export function clientSignupError(status: number, serverError: string | undefined, copy: SignupCopy): string {
  if (status === 400) return copy.invalid;
  if (serverError && copy === SIGNUP_COPY_EN && serverError !== copy.invalid) return serverError;
  if (status === 403) return copy.origin;
  if (status === 413) return copy.large;
  if (status === 429) return copy.limited;
  if (status >= 500) return copy.unavailable;
  return copy.network;
}
