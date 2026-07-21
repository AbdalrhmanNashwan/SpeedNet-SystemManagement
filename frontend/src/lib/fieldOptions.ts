/**
 * Curated dropdown options for fields that were previously free-text.
 * Using selects (instead of free typing) keeps values consistent and cuts
 * data-entry errors. Every dropdown also allows a custom value via the
 * "✎ custom…" escape in EditableField, so nothing is lost.
 */

export const STATUS_OPTIONS = [
  "Active", "Inactive", "Down", "Cancelled", "Future", "Self-Report", "Done",
];

export const LINK_TYPE_OPTIONS = [
  "C5c", "Mimosa", "RB912", "RB921", "AF-5XHD", "airFiber 24",
  "FTTX", "Fiber",
];

export const SWITCH_TYPE_OPTIONS = [
  "HUB", "Cisco", "RB2011", "RB3011", "RB4011",
  "CRS328", "CRS326", "CCR1009", "CCR1036",
];

// Radio / device models used on PTP links and sectors.
export const RADIO_MODEL_OPTIONS = [
  "C5c", "Rocket M5", "NanoStation M5", "PowerBeam", "LiteBeam", "LiteAP",
  "RB912", "RB921", "AF-5XHD", "AF-24",
];

export const SWITCH_MODEL_OPTIONS = SWITCH_TYPE_OPTIONS;

// Service-source feed mode: how the VLAN rides the port (matches note format).
export const FEED_MODE_OPTIONS = ["tag", "untag"];

// Source switch model — reuses the curated full switch models (CRS328, RB4011, …).
// EditableField still allows a custom value for anything outside this list.
export const FEED_MODEL_OPTIONS = SWITCH_TYPE_OPTIONS;

// Source port on the feeding switch. Covers a CRS328-24P-4S+ (24 ether + 4 sfp);
// EditableField still allows a custom value for anything outside this list.
export const PORT_OPTIONS = [
  ...Array.from({ length: 24 }, (_, i) => `eth${i + 1}`),
  "sfp1", "sfp2", "sfp3", "sfp4",
];

export const ZONE_COLOR_OPTIONS = [
  "cyan", "blue", "green", "yellow", "orange", "purple", "red",
];

export const ZONE_RULE_FIELD_OPTIONS = ["reseller", "area"];
