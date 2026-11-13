# What the suite covers

All in `app/e2e/signing.spec.ts`. Keep this file updated when you add or change tests.

| Test | Flow it proves |
|---|---|
| signers sign one after another, everyone gets the signed copy, and it verifies | Sign-in and first-time profile; upload, signers, boxes, send; only signer 1 is emailed first; signer 1 signs; signer 2 gets "Your turn"; signer 2 signs and the document completes; everyone gets "Signed by everyone"; the downloaded copy matches on the Verify page; a signer sees it under Completed and closed with "Sent by" the sender; the sender sees it as "You". |
| only the invited person can open and sign their invite | A different signed-in account with the invite link sees "sent to someone else" and no title or Sign here; a visitor without the link's key sees no title; the invitee sees the document and can sign; after confirming email, the invite appears under Waiting for your signature. |
| a signer can decline, and the sender is told why | Decline with a reason records on-chain; the signer sees "This document was declined"; the sender's email includes the reason; the sender's dashboard shows it as Declined. |
| one confirmed email belongs to one account | Confirming an email from the emailed link; a second wallet can't use an email another account already confirmed. |

## Not covered yet (good next tests)

- Sender cancels a document; signers get the cancelled email and the page says so.
- "All at once" document where both signers sign in either order.
- Waiting for others: a signer who already signed sees the document there, sent by someone else.
- Dashboard search, "Sent by" filter and pagination (more than 6 documents).
- Drafts: save & exit, resume at the right step, delete a draft.
- Skipping signature boxes (signatures only on the summary page).
- Saved signature reused on a second document.
- Sign-in with "Use a different wallet" from Finish your profile.
- Verify page with an original (unsigned) file and with an unknown file.
