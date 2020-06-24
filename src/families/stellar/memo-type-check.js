// @flow

import { log } from "@ledgerhq/logs";
import type { CacheRes } from "../../cache";
import { makeLRUCache } from "../../cache";
import { getEnv } from "../../env";
import network from "../../network";

const memoTypeCheckCache: CacheRes<Array<string>, ?string> = makeLRUCache(
  async (addr: string): Promise<?string> => getMemoTypeSuggested(addr),
  (addr: string) => addr,
  {
    max: 300,
    maxAge: 180 * 60 * 1000, // 3hours
  }
);

// It's check if the explorer get any info about the memo to recommand one,
// doesn't matter if it's don't have any
const getMemoTypeSuggested = async (addr: string): Promise<?string> => {
  const api = getEnv("API_STELLAR_MEMO");
  const url = `${api}/api/explorer/public/directory/${addr}`;

  const getMemoType = async () => {
    try {
      const { data } = await network({ url });
      return data && data.accepts ? data.accepts.memo : null;
    } catch (e) {
      if (e.status !== 404) {
        // error other than 404 is reported
        log("stellar-error", "failed on " + url + " : " + String(e));
      }
      // any error case must not prevent the send feature
      return null;
    }
  };

  const memoType = await getMemoType();

  memoTypeCheckCache.hydrate(addr, memoType);

  return memoType;
};

export default memoTypeCheckCache;
