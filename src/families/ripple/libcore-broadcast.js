// @flow
import { makeBroadcast } from "../../libcore/broadcast";
import { patchOperationWithHash } from "../../operation";

async function broadcast({
  core,
  coreAccount,
  signedOperation: { operation, signature }
}) {
  const rippleLikeAccount = core.CoreRippleLikeAccount.fromCoreAccount(
    coreAccount
  );
  const txHash = await rippleLikeAccount.broadcastRawTransaction(signature);
  return patchOperationWithHash(operation, txHash);
}

export default makeBroadcast({ broadcast });
