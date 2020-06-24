// @flow
import { log } from "@ledgerhq/logs";
import shuffle from "lodash/shuffle";
import priorityQueue from "async/priorityQueue";
import { concat, from } from "rxjs";
import { ignoreElements } from "rxjs/operators";

import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  useMemo,
} from "react";
import { getVotesCount, isUpToDateAccount } from "../../account";
import type { SubAccount, Account, CryptoCurrency } from "../../types";
import { getAccountBridge } from "..";
import { getAccountCurrency } from "../../account";
import { getEnv } from "../../env";
import type { SyncAction, SyncState, BridgeSyncState } from "./types";
import { BridgeSyncContext, BridgeSyncStateContext } from "./context";

export type Props = {
  // this is a wrapping component that you need to put in your tree
  children: React$Node,
  // you need to inject the accounts to sync on
  accounts: Account[],
  // provide a way to save the result of an account sync update
  updateAccountWithUpdater: (
    accountId: string,
    updater: (Account) => Account
  ) => void,
  // handles an error / log / do action with it
  // if the function returns falsy, the sync will ignore error, otherwise it's treated as error with the error you return (likely the same)
  recoverError: (Error) => ?Error,
  // track sync lifecycle for analytics
  trackAnalytics: (string, ?Object) => void,
  // load all data needed for a currency (it's calling currencyBridge prepare mechanism)
  prepareCurrency: (currency: CryptoCurrency) => Promise<void>,
  // provide an implementation of hydrate (it preload from a local storage impl the data cached from a previous prepare)
  hydrateCurrency: (currency: CryptoCurrency) => Promise<void>,
  // an array of token ids to blacklist from the account sync
  blacklistedTokenIds?: string[],
};

export const BridgeSync = ({
  children,
  accounts,
  updateAccountWithUpdater,
  recoverError,
  trackAnalytics,
  prepareCurrency,
  hydrateCurrency,
  blacklistedTokenIds,
}: Props) => {
  useHydrate({
    accounts,
    hydrateCurrency,
  });

  const [syncQueue, syncState] = useSyncQueue({
    accounts,
    prepareCurrency,
    recoverError,
    trackAnalytics,
    updateAccountWithUpdater,
    blacklistedTokenIds,
  });

  const sync = useSync({
    syncQueue,
    accounts,
  });

  useSyncBackground({
    sync,
  });

  useSyncContinouslyPendingOperations({
    sync,
    accounts,
  });

  return (
    <BridgeSyncStateContext.Provider value={syncState}>
      <BridgeSyncContext.Provider value={sync}>
        {children}
      </BridgeSyncContext.Provider>
    </BridgeSyncStateContext.Provider>
  );
};

// utility internal hooks for <BridgeSync>

// useHydrate: bridge.hydrate once for each currency

function useHydrate({ accounts, hydrateCurrency }) {
  const hydratedCurrencies = useRef({});
  useEffect(() => {
    const hydrated = hydratedCurrencies.current;
    for (const account of accounts) {
      const { currency } = account;
      if (!hydrated[currency.id]) {
        hydrated[currency.id] = true;
        hydrateCurrency(currency);
      }
    }
  }, [accounts, hydrateCurrency]);
}

const lastTimeAnalyticsTrackPerAccountId: { [accountId: string]: number } = {};
const nothingState = { pending: false, error: null };

// useHydrate: returns a sync queue and bridge sync state

function useSyncQueue({
  accounts,
  prepareCurrency,
  recoverError,
  trackAnalytics,
  updateAccountWithUpdater,
  blacklistedTokenIds,
}) {
  const [bridgeSyncState, setBridgeSyncState]: [BridgeSyncState, *] = useState(
    {}
  );

  const setAccountSyncState = useCallback((accountId: string, s: SyncState) => {
    setBridgeSyncState((state) => ({ ...state, [accountId]: s }));
  }, []);

  const synchronize = useCallback(
    (accountId: string, next: () => void) => {
      const state = bridgeSyncState[accountId] || nothingState;
      if (state.pending) {
        next();
        return;
      }
      const account = accounts.find((a) => a.id === accountId);
      if (!account) {
        next();
        return;
      }

      // FIXME if we want to stop syncs for specific currency (e.g. api down) we would do it here

      try {
        const bridge = getAccountBridge(account);
        setAccountSyncState(accountId, { pending: true, error: null });

        const startSyncTime = Date.now();
        const trackedRecently =
          lastTimeAnalyticsTrackPerAccountId[accountId] &&
          startSyncTime - lastTimeAnalyticsTrackPerAccountId[accountId] <
            90 * 1000;
        if (!trackedRecently) {
          lastTimeAnalyticsTrackPerAccountId[accountId] = startSyncTime;
        }
        const trackEnd = (event) => {
          if (trackedRecently) return;
          const account = accounts.find((a) => a.id === accountId);
          if (!account) return;
          const subAccounts: SubAccount[] = account.subAccounts || [];
          trackAnalytics(event, {
            duration: (Date.now() - startSyncTime) / 1000,
            currencyName: account.currency.name,
            derivationMode: account.derivationMode,
            freshAddressPath: account.freshAddressPath,
            operationsLength: account.operationsCount,
            accountsCountForCurrency: accounts.filter(
              (a) => a.currency === account.currency
            ).length,
            tokensLength: subAccounts.length,
            votesCount: getVotesCount(account),
          });

          if (event === "SyncSuccess") {
            subAccounts.forEach((a) => {
              const tokenId =
                a.type === "TokenAccount"
                  ? getAccountCurrency(a).id
                  : account.currency.name;
              trackAnalytics("SyncSuccessToken", {
                tokenId,
                tokenTicker: getAccountCurrency(a).ticker,
                operationsLength: a.operationsCount,
                parentCurrencyName: account.currency.name,
                parentDerivationMode: account.derivationMode,
                votesCount: getVotesCount(a, account),
              });
            });
          }
        };

        const syncConfig = {
          paginationConfig: {},
          blacklistedTokenIds,
        };

        concat(
          from(prepareCurrency(account.currency)).pipe(ignoreElements()),
          bridge.sync(account, syncConfig)
        ).subscribe({
          next: (accountUpdater) => {
            updateAccountWithUpdater(accountId, accountUpdater);
          },
          complete: () => {
            trackEnd("SyncSuccess");
            setAccountSyncState(accountId, {
              pending: false,
              error: null,
            });
            next();
          },
          error: (raw: Error) => {
            const error = recoverError(raw);

            if (!error) {
              // This error is normal because the thread was recently killed. we silent it for the user.
              setAccountSyncState(accountId, {
                pending: false,
                error: null,
              });
              next();
              return;
            }

            if (error && error.name !== "NetworkDown") {
              trackEnd("SyncError");
            }

            setAccountSyncState(accountId, { pending: false, error });
            next();
          },
        });
      } catch (error) {
        setAccountSyncState(accountId, { pending: false, error });
        next();
      }
    },
    [
      accounts,
      bridgeSyncState,
      prepareCurrency,
      recoverError,
      setAccountSyncState,
      trackAnalytics,
      updateAccountWithUpdater,
      blacklistedTokenIds,
    ]
  );

  const synchronizeRef = useRef(synchronize);
  useEffect(() => {
    synchronizeRef.current = synchronize;
  }, [synchronize]);

  const [syncQueue] = useState(() =>
    priorityQueue(
      (...a) => synchronizeRef.current(...a),
      getEnv("SYNC_MAX_CONCURRENT")
    )
  );

  return [syncQueue, bridgeSyncState];
}

// useSync: returns a sync function with the syncQueue

function useSync({ syncQueue, accounts }) {
  const skipUnderPriority = useRef(-1);

  const sync = useMemo(() => {
    const schedule = (ids: string[], priority: number) => {
      if (priority < skipUnderPriority.current) return;
      // by convention we remove concurrent tasks with same priority
      // FIXME this is somehow a hack. ideally we should just dedup the account ids in the pending queue...
      syncQueue.remove((o) => priority === o.priority);
      log("bridge", "schedule " + ids.join(", "));
      syncQueue.push(ids, -priority);
    };

    // don't always sync in the same order to avoid potential "account never reached"
    const shuffledAccountIds = () => shuffle(accounts.map((a) => a.id));

    const handlers = {
      BACKGROUND_TICK: () => {
        if (syncQueue.idle()) {
          schedule(shuffledAccountIds(), -1);
        }
      },

      SET_SKIP_UNDER_PRIORITY: ({ priority }: { priority: number }) => {
        if (priority === skipUnderPriority.current) return;
        skipUnderPriority.current = priority;
        syncQueue.remove(({ priority }) => priority < skipUnderPriority);
        if (priority === -1 && !accounts.every(isUpToDateAccount)) {
          // going back to -1 priority => retriggering a background sync if it is "Paused"
          schedule(shuffledAccountIds(), -1);
        }
      },

      SYNC_ALL_ACCOUNTS: ({ priority }: { priority: number }) => {
        schedule(shuffledAccountIds(), priority);
      },

      SYNC_ONE_ACCOUNT: ({
        accountId,
        priority,
      }: {
        accountId: string,
        priority: number,
      }) => {
        schedule([accountId], priority);
      },

      SYNC_SOME_ACCOUNTS: ({
        accountIds,
        priority,
      }: {
        accountIds: string[],
        priority: number,
      }) => {
        schedule(accountIds, priority);
      },
    };

    return (action: SyncAction) => {
      const handler = handlers[action.type];
      if (handler) {
        log("bridge", `action ${action.type}`, { action, type: "syncQueue" });
        // $FlowFixMe
        handler(action);
      } else {
        log("warn", "BridgeSyncContext unsupported action", {
          action,
          type: "syncQueue",
        });
      }
    };
  }, [accounts, syncQueue]);

  const ref = useRef(sync);
  useEffect(() => {
    ref.current = sync;
  }, [sync]);

  const syncFn = useCallback((action) => ref.current(action), [ref]);

  return syncFn;
}

// useSyncBackground: continuously synchronize accounts in background

function useSyncBackground({ sync }) {
  useEffect(() => {
    let syncTimeout;
    const syncLoop = async () => {
      sync({ type: "BACKGROUND_TICK" });
      syncTimeout = setTimeout(syncLoop, getEnv("SYNC_ALL_INTERVAL"));
    };
    syncTimeout = setTimeout(syncLoop, getEnv("SYNC_BOOT_DELAY"));
    return () => clearTimeout(syncTimeout);
  }, [sync]);
}

// useSyncContinouslyPendingOperations: continously sync accounts with pending operations

function useSyncContinouslyPendingOperations({ sync, accounts }) {
  const ids = useMemo(
    () =>
      accounts.filter((a) => a.pendingOperations.length > 0).map((a) => a.id),
    [accounts]
  );

  const refIds = useRef(ids);
  useEffect(() => {
    refIds.current = ids;
  }, [ids]);

  useEffect(() => {
    let timeout;
    const update = () => {
      sync({
        type: "SYNC_SOME_ACCOUNTS",
        accountIds: refIds.current,
        priority: 20,
      });
      timeout = setTimeout(update, getEnv("SYNC_PENDING_INTERVAL"));
    };
    timeout = setTimeout(update, getEnv("SYNC_PENDING_INTERVAL"));
    return () => clearTimeout(timeout);
  }, [sync]);
}
