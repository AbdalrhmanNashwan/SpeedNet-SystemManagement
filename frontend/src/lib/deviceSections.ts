import type { Device, DeviceType } from "@/types";
import { RADIO_MODEL_OPTIONS, SWITCH_MODEL_OPTIONS } from "./fieldOptions";

export interface DeviceCol {
  key: keyof Device;
  label: string;
  mono?: boolean;
  options?: string[];
}

export interface DeviceSectionDef {
  type: DeviceType;
  label: string;
  icon: string;
  cols: DeviceCol[];
}

/** Single source of truth for the device sections, shared by the tower detail
 *  page and the global per-section browse pages. */
export const DEVICE_SECTIONS: DeviceSectionDef[] = [
  {
    type: "links",
    label: "Links",
    icon: "📡",
    cols: [
      { key: "ssid", label: "SSID" },
      { key: "device_name", label: "Device" },
      { key: "device_type", label: "Type", options: RADIO_MODEL_OPTIONS },
      { key: "wireless_pass", label: "Password", mono: true },
      { key: "ip", label: "IP", mono: true },
      { key: "gateway", label: "Gateway", mono: true },
      { key: "mac_address", label: "MAC", mono: true },
      { key: "target", label: "Target" },
    ],
  },
  {
    type: "switches",
    label: "Switches",
    icon: "🔀",
    cols: [
      { key: "device_name", label: "Name" },
      { key: "model", label: "Model", options: SWITCH_MODEL_OPTIONS },
      { key: "ip", label: "IP", mono: true },
      { key: "gateway", label: "Gateway", mono: true },
      { key: "username", label: "Username", mono: true },
      { key: "password", label: "Password", mono: true },
      { key: "port", label: "Port", mono: true },
    ],
  },
  {
    type: "sectors",
    label: "Sectors (APs)",
    icon: "📶",
    cols: [
      { key: "ssid", label: "SSID" },
      { key: "device_name", label: "Device" },
      { key: "device_type", label: "Type", options: RADIO_MODEL_OPTIONS },
      { key: "wireless_pass", label: "Password", mono: true },
      { key: "ip", label: "IP", mono: true },
      { key: "mac_address", label: "MAC", mono: true },
      { key: "username", label: "Username", mono: true },
      { key: "password", label: "Password", mono: true },
    ],
  },
  {
    type: "servers",
    label: "Servers",
    icon: "🖥️",
    cols: [
      { key: "device_name", label: "Name" },
      { key: "url", label: "URL", mono: true },
      { key: "username", label: "Username", mono: true },
      { key: "password", label: "Password", mono: true },
      { key: "ip", label: "IP", mono: true },
    ],
  },
];

export const SECTION_BY_TYPE: Record<DeviceType, DeviceSectionDef> =
  Object.fromEntries(DEVICE_SECTIONS.map((s) => [s.type, s])) as Record<DeviceType, DeviceSectionDef>;
