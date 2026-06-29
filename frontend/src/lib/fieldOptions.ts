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

export const ZONE_COLOR_OPTIONS = [
  "cyan", "blue", "green", "yellow", "orange", "purple", "red",
];

export const ZONE_RULE_FIELD_OPTIONS = ["reseller", "area"];
