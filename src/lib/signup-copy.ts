/** User-facing signup sentences. Browser-safe: no server imports. */
export const SIGNUP_COPY = {
  ok: "Thanks. We have your name and email. We’ll use them only to send updates and help resources.",
  invalid: "Enter your name and an email address.",
  limited:
    "That’s enough signups from this connection for now. Email hello@helpgetup.com if you still want updates.",
  origin: "That signup has to come from helpgetup.com.",
  large: "That signup is too long. Email hello@helpgetup.com instead.",
  network: "Couldn’t reach the server. Try again, or email hello@helpgetup.com.",
} as const;
