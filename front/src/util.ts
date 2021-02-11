import { useState } from "react";
import { Stroke, Point } from "./Canvas";

export const __DEV__ = process.env.NODE_ENV === "development";

export const debug = __DEV__ ? console.log : () => {};

export function _arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function _base64ToArrayBuffer(base64: string) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const getRandInRange = (min: number, max: number) => {
  return Math.floor(Math.random() * (max + 1 - min) + min);
};

export interface MainContext {
  errorMsg: string;
  myPrivateKey: any;
  myPublicKey: any;
  name: string;
  target: string;
  sharedKey: any;
  helloCounter: number;
  targetKey: any;
  testData: any;
  forky: boolean;
  level: number;
  allowLower: boolean;
  aliceData: any;
  oppData: any;
  aliceGuess: string;
  bobGuess: string;
  oppDisconnected: boolean;
}

const serialiseStroke = (stroke: Stroke) => {
  try {
    let points = new Uint8Array(
      stroke.points.flatMap(([x, y]) => [x >> 8, x & 255, y >> 8, y & 255])
    );
    return [
      stroke.colour,
      stroke.brushRadius,
      stroke.size,
      _arrayBufferToBase64(points),
    ];
  } catch (e) {
    debug(e);
    return ["#000", 5, 400, ""];
  }
};

const deserialiseStroke = (row: any[]): Stroke => {
  try {
    let points: Point[] = [];
    const pointBytes = new Uint8Array(_base64ToArrayBuffer(row[3]));
    for (let i = 0; i < pointBytes.length; i += 4) {
      points.push([
        (pointBytes[i] << 8) + pointBytes[i + 1],
        (pointBytes[i + 2] << 8) + pointBytes[i + 3],
      ]);
    }
    return { colour: row[0], brushRadius: row[1], size: row[2], points };
  } catch (e) {
    debug(e);
    return { colour: "#000", brushRadius: 5, size: 400, points: [] };
  }
};

export const serialiseStrokes = (strokes: Stroke[]): any[] =>
  strokes.map(serialiseStroke);

export const deserialiseStrokes = (rows: any[]): Stroke[] =>
  rows.map(deserialiseStroke);

// from https://usehooks.com/useLocalStorage/
export function useLocalStorage<T>(key: string, initialValue: T): any {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      debug(error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // A more advanced implementation would handle the error case
      debug(error);
    }
  };

  return [storedValue, setValue];
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
export function hexToRgb(hex: string) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgb(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(
        result[3],
        16
      )})` /*{
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }*/
    : "rgb(0,0,0)";
}
