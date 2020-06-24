// @flow

import type { Core, CoreOperation } from "../../libcore/types";
import invariant from "invariant";

async function rippleBuildOperation({
  core,
  coreOperation
}: {
  core: Core,
  coreOperation: CoreOperation
}) {
  const rippleLikeOperation = core.RippleLikeOperation.fromCoreOperation(
    coreOperation
  );
  invariant(rippleLikeOperation, "ripple operation expected");
  const rippleLikeTransaction = await rippleLikeOperation.getTransaction();
  const hash = await rippleLikeTransaction.getHash();
  return { hash };
}

export default rippleBuildOperation;
