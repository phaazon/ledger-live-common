// @flow
import type { NetworkInfo } from "./types";
import type { Core, CoreAccount } from "../../libcore/types";
import { libcoreAmountToBigNumber } from "../../libcore/buildBigNumber";
import invariant from "invariant";

type Input = {
  core: Core,
  coreAccount: CoreAccount
};

type Output = Promise<NetworkInfo>;

async function ripple({ core, coreAccount }: Input): Output {
  const rippleLikeAccount = core.RippleLikeAccount.fromCoreAccount(coreAccount);
  invariant(rippleLikeAccount, "ripple account expected");
  const feesRaw = await rippleLikeAccount.getFees();
  const baseReserveRaw = await rippleLikeAccount.getBaseReserve();
  const baseReserve = await libcoreAmountToBigNumber(baseReserveRaw);
  const serverFee = await libcoreAmountToBigNumber(feesRaw);

  return {
    family: "ripple",
    serverFee,
    baseReserve,
  };
}

export default ripple;
