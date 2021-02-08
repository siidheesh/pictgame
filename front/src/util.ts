import { useState } from "react";
import { Stroke } from "./Canvas";

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
  forky: boolean; // true if we responded to a MATCHREQ, false if we responded to a HELLO
  level: number;
  allowLower: boolean;
  oppData: any;
  aliceGuess: string;
  bobGuess: string;
}

const serialiseStroke = (stroke: Stroke) => {
  let points = new Uint8Array(
    stroke.points.flatMap(([x, y]) => [x >> 8, x & 255, y >> 8, y & 255])
  );
  return [stroke.colour, stroke.brushRadius, _arrayBufferToBase64(points)];
};

const deserialiseStroke = (row: any[]): Stroke => {
  let points: [number, number][] = [];
  const pointBytes = new Uint8Array(_base64ToArrayBuffer(row[2]));
  for (let i = 0; i < pointBytes.length; i += 4) {
    points.push([
      (pointBytes[i] << 8) + pointBytes[i + 1],
      (pointBytes[i + 2] << 8) + pointBytes[i + 3],
    ]);
  }
  return { colour: row[0], brushRadius: row[1], points };
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
      console.log(error);
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
      console.log(error);
    }
  };

  return [storedValue, setValue];
}
