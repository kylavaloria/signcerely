/**
 * Who may sign an invite slot.
 *
 * The invite link proves you got the email, but it can end up in the wrong hands
 * (forwarded, or copied by the sender). So signing also requires that the signed-in
 * account belongs to the invited person: either its wallet already holds this slot,
 * or its email is the one the invite was sent to (confirmed, or proven by the link).
 */
export type AccessInput = {
  wallet: string | null;
  slotWallet: string | null;
  invitedEmail: string;
  profileEmail: string | null;
  emailConfirmed: boolean;
  isSender: boolean;
  /** The invite link's key was shown in this browser. */
  byLink: boolean;
};

export type AccessDecision = {
  /** Has the visitor proven the invite (link, confirmed email, or their wallet holds the slot)? */
  invited: boolean;
  /** May this signed-in visitor sign or decline this slot? */
  canSign: boolean;
  /** Signed in with the invite in hand, but as someone it wasn't meant for. */
  wrongAccount: boolean;
};

export function decideAccess(i: AccessInput): AccessDecision {
  const byWallet = Boolean(i.wallet && i.slotWallet === i.wallet);
  const sameEmail = Boolean(i.profileEmail && i.profileEmail.toLowerCase() === i.invitedEmail.toLowerCase());
  // A confirmed email counts; so does the sender's own (unconfirmed) email on their own document.
  const byEmail = sameEmail && (i.emailConfirmed || i.isSender);
  const invited = i.byLink || byEmail || byWallet;
  // The link only counts for an account whose email is the invited one.
  const isTheInvitee = byWallet || byEmail || (i.byLink && sameEmail);
  const canSign = invited && Boolean(i.wallet) && isTheInvitee;
  return { invited, canSign, wrongAccount: invited && Boolean(i.wallet) && !isTheInvitee };
}

/** "k•••@gmail.com" — enough to recognize the address without publishing it. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "the invited email";
  return `${name.slice(0, 1)}•••@${domain}`;
}
