import React, { useState, useRef, ChangeEvent } from "react";
import ToggleButton from "@material-ui/lab/ToggleButton";
//import CheckIcon from "@material-ui/icons/Check";
import { Button, Slider, TextField } from "@material-ui/core";
import { Icon } from "@iconify/react";
import eraserIcon from "@iconify-icons/mdi/eraser";

import Canvas from "./Canvas";
import { Stroke } from "./Canvas";

import "./App.css";

interface Props {
  [key: string]: any;
}

function App(props: Props) {
  const defaultProps: Props = {
    brushRadius: 5,
    brushRadiusMin: 1,
    brushRadiusMax: 50,
    brushRadiusStep: 1,
    canvasSize: 300,
    brushColour: "black",
  };
  const getProp = (propName: string) => {
    return props[propName] ?? defaultProps[propName];
  };

  const [eraseMode, setEraseMode] = useState(false);
  const [brushColour, setBrushColour] = useState(getProp("brushColour"));
  const [brushRadius, setbrushRadius] = useState(getProp("brushRadius"));

  //const [strokeHistory, setStrokeHistory] = useState([] as Stroke[]);
  const [forcedHistory, setForcedHistory] = useState([] as Stroke[]);
  const strokeHistory = useRef([] as Stroke[]);

  function replayStrokes() {
    setForcedHistory(strokeHistory.current);
  }

  function handleColorChange(e: ChangeEvent<HTMLInputElement>) {
    setBrushColour(e.target.value);
  }

  return (
    <div className="App">
      <h1>Pictionary drawing UI</h1>
      <p>eraseMode: {eraseMode ? "yes" : "no"}</p>
      <ToggleButton
        value="check"
        selected={eraseMode}
        onChange={() => setEraseMode(!eraseMode)}
      >
        <Icon icon={eraserIcon} />
      </ToggleButton>
      <p>brushRadius: {brushRadius}</p>
      <TextField
        label="Color"
        variant="filled"
        defaultValue={brushColour}
        onChange={handleColorChange}
      />
      <Slider
        value={brushRadius}
        getAriaValueText={() => "brushRadius"}
        aria-labelledby="discrete-slider-small-steps"
        step={getProp("brushRadiusStep")}
        min={getProp("brushRadiusMin")}
        max={getProp("brushRadiusMax")}
        marks
        valueLabelDisplay="on"
        onChange={(e, value) => setbrushRadius(value as number)}
      />
      <p>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            console.log(JSON.stringify(strokeHistory.current));
          }}
        >
          Save
        </Button>
      </p>
      <p>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setForcedHistory(
              JSON.parse(prompt("enter json:") ?? JSON.stringify(forcedHistory))
            );
          }}
        >
          Load
        </Button>
      </p>
      <p>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            setForcedHistory([]);
            props.onEvent("CLEAR_CANVAS");
          }}
        >
          Clear
        </Button>
      </p>
      <p>
        <Button variant="contained" color="secondary" onClick={replayStrokes}>
          Retrace history
        </Button>
      </p>
      <Canvas
        strokeHistory={strokeHistory}
        onStrokeHistoryChange={(newStrokeHist: Stroke[]) => {
          strokeHistory.current = newStrokeHist;
        }}
        forcedHistory={forcedHistory}
        brushColour={brushColour}
        brushRadius={brushRadius}
        eraseMode={eraseMode}
      />
    </div>
  );
}

export default App;
