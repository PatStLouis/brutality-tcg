import { redemptionByToken } from "@brutality/core";
import { PackOpener } from "./PackOpener";

export default async function OpenPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const redemption = redemptionByToken(token);

  if (!redemption) {
    return (
      <div className="open-stage">
        <h1>Pack not found</h1>
        <p className="muted">This link is not a valid redemption.</p>
      </div>
    );
  }

  const expired =
    redemption.status === "expired" ||
    (redemption.status === "pending" &&
      new Date(redemption.expiresTs).getTime() < Date.now());

  if (expired) {
    return (
      <div className="open-stage">
        <h1>Pack expired</h1>
        <p className="muted">
          This link expired before it was opened. The pack credit was returned —
          run <code>!redeem</code> again in Discord.
        </p>
      </div>
    );
  }

  return (
    <PackOpener
      token={token}
      alreadyOpened={redemption.status === "opened"}
      commitment={redemption.commitment}
    />
  );
}
