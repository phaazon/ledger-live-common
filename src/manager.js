// @flow
/* eslint-disable camelcase */
// Higher level cache on top of Manager

import semver from "semver";
import type { DeviceModelId } from "@ledgerhq/devices";
import { UnknownMCU } from "@ledgerhq/errors";
import type {
  ApplicationVersion,
  DeviceInfo,
  OsuFirmware,
  FirmwareUpdateContext,
} from "./types/manager";
import { listCryptoCurrencies } from "./currencies";
import ManagerAPI from "./api/Manager";

const ICONS_FALLBACK = {
  bitcoin_testnet: "bitcoin",
};

const oldAppsInstallDisabled = ["ZenCash", "Ripple", "Ontology"];
const canHandleInstall = (app: ApplicationVersion) =>
  !oldAppsInstallDisabled.includes(app.name) &&
  !listCryptoCurrencies(true, true).some(
    (coin) =>
      coin.managerAppName &&
      coin.terminated &&
      coin.managerAppName.toLowerCase() === app.name.toLowerCase()
  );

const CacheAPI = {
  // TODO: Move to new ManagerAPI
  // When ready, the manager api will return an icon url instead of a name
  getIconUrl: (icon: string): string => {
    const icn = ICONS_FALLBACK[icon] || icon;
    return `https://api.ledgerwallet.com/update/assets/icons/${icn}`;
  },

  getFirmwareVersion: (firmware: OsuFirmware): string =>
    firmware.name.replace("-osu", ""),

  // TO BE CONFIRMED – LL-2568
  firmwareUpdateNeedsLegacyBlueResetInstructions: (
    deviceInfo: DeviceInfo,
    deviceModelId: DeviceModelId
  ) => deviceModelId === "blue" && semver.lt(deviceInfo.version, "2.1.1"),

  // TO BE CONFIRMED – LL-2564
  firmwareUpdateWillResetSeed: (
    deviceInfo: DeviceInfo,
    deviceModelId: DeviceModelId,
    _firmware: FirmwareUpdateContext
  ) => deviceModelId === "blue" && semver.lt(deviceInfo.version, "2.1.1"),

  firmwareUpdateWillUninstallApps: (
    _deviceInfo: DeviceInfo,
    _deviceModelId: DeviceModelId
  ) => true, // true for all? TO BE CONFIRMED – LL-2710

  firmwareUpdateRequiresUserToUninstallApps: (
    deviceModel: DeviceModelId,
    deviceInfo: DeviceInfo
  ): boolean =>
    deviceModel === "nanoS" && semver.lte(deviceInfo.version, "1.4.2"),

  formatHashName: (
    input: string,
    // FIXME these will be made mandatory
    deviceModel?: DeviceModelId,
    deviceInfo?: DeviceInfo
  ): string => {
    const shouldEllipsis =
      deviceModel && deviceInfo
        ? deviceModel === "blue" ||
          (deviceModel === "nanoS" && semver.lt(deviceInfo.version, "1.6.0"))
        : true;
    const hash = (input || "").toUpperCase();
    return hash.length > 8 && shouldEllipsis
      ? `${hash.slice(0, 4)}...${hash.substr(-4)}`
      : hash;
  },

  canHandleInstall,

  getLatestFirmwareForDevice: async (
    deviceInfo: DeviceInfo
  ): Promise<?FirmwareUpdateContext> => {
    const mcusPromise = ManagerAPI.getMcus();

    // Get device infos from targetId
    const deviceVersion = await ManagerAPI.getDeviceVersion(
      deviceInfo.targetId,
      deviceInfo.providerId
    );

    let osu;

    if (deviceInfo.isOSU) {
      osu = await ManagerAPI.getCurrentOSU({
        deviceId: deviceVersion.id,
        provider: deviceInfo.providerId,
        version: deviceInfo.version,
      });
    } else {
      // Get firmware infos with firmware name and device version
      const seFirmwareVersion = await ManagerAPI.getCurrentFirmware({
        version: deviceInfo.version,
        deviceId: deviceVersion.id,
        provider: deviceInfo.providerId,
      });

      // Fetch next possible firmware
      osu = await ManagerAPI.getLatestFirmware({
        current_se_firmware_final_version: seFirmwareVersion.id,
        device_version: deviceVersion.id,
        provider: deviceInfo.providerId,
      });
    }

    if (!osu) {
      return null;
    }

    const final = await ManagerAPI.getFinalFirmwareById(
      osu.next_se_firmware_final_version
    );

    const mcus = await mcusPromise;

    const currentMcuVersion = mcus.find(
      (mcu) => mcu.name === deviceInfo.mcuVersion
    );

    if (!currentMcuVersion) throw new UnknownMCU();

    const shouldFlashMCU = !final.mcu_versions.includes(currentMcuVersion.id);

    return { final, osu, shouldFlashMCU };
  },

  // get list of apps for a given deviceInfo
  getAppsList: async (
    deviceInfo: DeviceInfo,
    isDevMode: boolean = false,
    // TODO getFullListSortedCryptoCurrencies can be a local function.. too much dep for now
    getFullListSortedCryptoCurrencies: * = () => Promise.resolve([])
  ): Promise<ApplicationVersion[]> => {
    console.warn("deprecated: use @ledgerhq/live-common/src/apps/* instead");

    if (deviceInfo.isOSU || deviceInfo.isBootloader) return Promise.resolve([]);

    const deviceVersionP = ManagerAPI.getDeviceVersion(
      deviceInfo.targetId,
      deviceInfo.providerId
    );

    const firmwareDataP = deviceVersionP.then((deviceVersion) =>
      ManagerAPI.getCurrentFirmware({
        deviceId: deviceVersion.id,
        version: deviceInfo.version,
        provider: deviceInfo.providerId,
      })
    );

    const applicationsByDeviceP = Promise.all([
      deviceVersionP,
      firmwareDataP,
    ]).then(([deviceVersion, firmwareData]) =>
      ManagerAPI.applicationsByDevice({
        provider: deviceInfo.providerId,
        current_se_firmware_final_version: firmwareData.id,
        device_version: deviceVersion.id,
      })
    );

    const [
      applicationsList,
      compatibleAppVersionsList,
      sortedCryptoCurrencies,
    ] = await Promise.all([
      ManagerAPI.listApps(),
      applicationsByDeviceP,
      getFullListSortedCryptoCurrencies(),
    ]);

    const filtered = isDevMode
      ? compatibleAppVersionsList.slice(0)
      : compatibleAppVersionsList.filter((version) => {
          const app = applicationsList.find((e) => e.id === version.app);
          if (app) {
            return app.category !== 2;
          }
          return false;
        });
    const sortedCryptoApps = [];
    // sort by crypto first
    sortedCryptoCurrencies.forEach((crypto) => {
      const app = filtered.find(
        (item) =>
          item.name.toLowerCase() === crypto.managerAppName.toLowerCase()
      );
      if (app) {
        filtered.splice(filtered.indexOf(app), 1);
        sortedCryptoApps.push({ ...app, currency: crypto });
      }
    });

    return sortedCryptoApps.concat(filtered);
  },
};

export default CacheAPI;
