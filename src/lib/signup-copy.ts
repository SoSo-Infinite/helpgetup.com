/**
 * User-facing signup sentences. Browser-safe: no server imports.
 * The success copy says what actually happens: we save the signup, this form
 * does not send mail, and a note from hello@ only goes out when there is
 * something to share. There is no promised day.
 */
const okLead = "Thanks. You’re on the list.";
const okNext =
  "We use your name and email only for updates and help resources. This signup doesn’t send an email on its own. When we have an update or a resource to share, we write from hello@helpgetup.com. There isn’t a set schedule.";
const okFoodBefore = "If you need food today, use the ";
const okFoodLabel = "Albany County food list";
const okFoodAfter = ".";

export const SIGNUP_COPY = {
  okLead,
  okNext,
  okFoodBefore,
  okFoodLabel,
  okFoodAfter,
  ok: `${okLead} ${okNext} ${okFoodBefore}${okFoodLabel}${okFoodAfter}`,
  invalid: "Enter your name and an email address.",
  limited:
    "That’s enough signups from this connection for now. Email hello@helpgetup.com if you still want updates.",
  origin: "That signup has to come from helpgetup.com.",
  large: "That signup is too long. Email hello@helpgetup.com instead.",
  network: "Couldn’t reach the server. Try again, or email hello@helpgetup.com.",
} as const;
