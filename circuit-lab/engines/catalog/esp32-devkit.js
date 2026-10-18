import {PROFILES, ESP32_LEFT, ESP32_RIGHT, boardPinInfo} from './boards.js';

export const BOARD = {
  name: 'ESP32-DevKitC V4',
  manufacturer: 'Espressif',
  revision: 'V4',
  module: 'ESP32-WROOM-32E-N4',
  chip: 'ESP32-D0WD-V3',
  width: 27.94,
  length: 48.26,
  pitch: 2.54,
  rowSpacing: 25.4,
  moduleSize: [18, 25.5, 3.1],
  estimated: {
    pcbThickness: 1.6,
    cornerRadius: 0.7,
    headerPinWidth: 0.64,
    headerHeight: 2.5,
    usbShell: [8, 3, 6],
    switchTravel: 0.25,
  },
  sources: PROFILES.board.sources,
};

export const LEFT = ESP32_LEFT;

export const RIGHT = ESP32_RIGHT;

export const GPIO = {VP: 36, VN: 39, TX: 1, RX: 3, SD2: 9, SD3: 10, CMD: 11, SD1: 8, SD0: 7, CLK: 6};

export const gpioNumber = label => (label.startsWith('IO') ? Number(label.slice(2)) : GPIO[label]);

export const ADC1 = [36, 39, 34, 35, 32, 33];

export const ADC2 = [4, 0, 2, 15, 13, 12, 14, 27, 25, 26];

export const inputOnly = [34, 35, 36, 39];

export const reserved = [6, 7, 8, 9, 10, 11];

export const strapping = [0, 2, 5, 12, 15];

export const pinDescription = label =>
  boardPinInfo(PROFILES.board, PROFILES.board.pins.find(t => t.id === label) ?? {id: label, label});
