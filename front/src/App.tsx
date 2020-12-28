import React, { useState, useRef, useEffect } from "react";
import ToggleButton from "@material-ui/lab/ToggleButton";
//import CheckIcon from "@material-ui/icons/Check";
import { Button, Slider } from "@material-ui/core";
import ColorPicker from "material-ui-color-picker";
import { Icon, InlineIcon } from '@iconify/react';
import eraserIcon from '@iconify-icons/mdi/eraser';


import "./App.css";
/*
function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}
*/

type Props = { [key: string]: number };

function App(props: Props) {
  const defaultProps: Props = {
    brushRadius: 10,
    brushRadiusMin: 1,
    brushRadiusMax: 50,
    brushRadiusStep: 1,
    canvasSize: 300,
  };
  const getProp = (propName: string) => {
    return props[propName] ?? defaultProps[propName];
  };

  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [drawMode, setDrawMode] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [brushColour, setBrushColour] = useState("#000000");
  const [brushRadius, setbrushRadius] = useState(getProp("brushRadius"));

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas')),
    context = useRef<CanvasRenderingContext2D | null>(null),
    boundRect = useRef<DOMRectReadOnly | null>(null),
    canvasRef2 = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  function handleCanvasWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    //console.log(e);
    const direction = e.detail < 0 || e.deltaY > 0 ? 1 : 0; // are we scrolling up or down?
    setbrushRadius(
      direction
        ? Math.max(
            brushRadius - getProp("brushRadiusStep"),
            getProp("brushRadiusMin")
          )
        : Math.min(
            brushRadius + getProp("brushRadiusStep"),
            getProp("brushRadiusMax")
          )
    );
  }

  function getCanvasContext() {
    // redundancy
    const ctx = context.current;
    if (ctx === null) {
      const canvas = canvasRef.current;
      context.current = canvas.getContext("2d");
    }
    return ctx;
  }

  function convertCoords(x: number, y: number) {
    let rect = boundRect.current;
    if (rect === null) {
      boundRect.current = canvasRef.current.getBoundingClientRect();
      rect = boundRect.current;
    }
    const canvasX = Math.floor(x - rect.left); // ts actually caught me using parseInt instead of Math.floor/toFixed... heh.
    const canvasY = Math.floor(y - rect.top + window.scrollY);
    return [canvasX, canvasY];
  }

  function startPaint(x: number, y: number, ctx = getCanvasContext()) {
    if(ctx === null) return;
 
    setDrawMode(true);

    const [canvasX, canvasY] = convertCoords(x, y);
    setLastX(canvasX);
    setLastY(canvasY);

    ctx.beginPath();
    ctx.fillStyle = eraseMode ? "#ffffff" : brushColour;
    ctx.arc(canvasX, canvasY, brushRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  function paint(x: number, y: number, ctx = getCanvasContext()) {
    if(ctx === null) return;

    const [canvasX, canvasY] = convertCoords(x, y);

    if (drawMode) {
      ctx.beginPath();
      ctx.lineWidth = brushRadius * 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = eraseMode ? "#ffffff" : brushColour; // erasing is the same as drawing, with a colour diff
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(canvasX, canvasY);
      ctx.stroke();
    } else return;

    setLastX(canvasX);
    setLastY(canvasY);
  }

  function endPaint() {
    if (drawMode) setDrawMode(false); // reset draw mode. eraseMode is manually (un)set by user
  }

  function clearCanvas() {
    const ctx = getCanvasContext();
    if (ctx != null)
      ctx.clearRect(0, 0, getProp("canvasSize"), getProp("canvasSize"));
  }

  function saveImage() {
    const ctx = getCanvasContext();
    if(ctx != null) {
      const image = ctx.getImageData(0, 0, getProp("canvasSize"), getProp("canvasSize"));
      console.log(image);
      if (canvasRef2.current != null) {
        const ctx = canvasRef2.current.getContext("2d");
        if (ctx != null) {
          ctx.clearRect(0, 0, getProp("canvasSize"), getProp("canvasSize"));
          ctx.putImageData(image, 0, 0);
        }
      }
    }
    //const dataURL = canvas.toDataURL("image/png", 0.5);
    //console.log(dataURL);
    /*
    const withoutAlpha = new Uint8ClampedArray((image.data.length / 4) * 3);
    for(let i = 0; i < image.data.length; i += 4) { //keep only alpha
      withoutAlpha[i] = image.data[i+3];
    }
    console.log(withoutAlpha);
    const withAlpha = new Uint8ClampedArray((withoutAlpha.length / 1) * 4);
    for(let i = 0; i < withoutAlpha.length; i += 1) { //add rest
      withAlpha[i] = 0;//withoutAlpha[i];
      withAlpha[i+1] = 0;//withoutAlpha[i+1];
      withAlpha[i+2] = 0;//withoutAlpha[i+2];
      withAlpha[i+4] = withoutAlpha[i];
    }
    console.log(withAlpha);
    const imageData = new ImageData(withAlpha, 300*300);*/
  }

  useEffect(() => { // bounding box changes on viewport change, hence the need to update it
    //update canvas and context refs
    context.current = canvasRef.current.getContext("2d");
    boundRect.current = canvasRef.current.getBoundingClientRect();
    console.log(boundRect.current.left, boundRect.current.top);
  }, [canvasRef]);

  return (
    <div className="App">
      <h1>Pictionary drawing UI</h1>
      <p>lastX: {lastX}</p>
      <p>lastY: {lastY}</p>
      <p>drawMode: {drawMode ? "yes" : "no"}</p>
      <p>eraseMode: {eraseMode ? "yes" : "no"}</p>
      <ToggleButton
        value="check"
        selected={eraseMode}
        onChange={() => setEraseMode(!eraseMode)}
      >
       <Icon icon={eraserIcon} /> 
      </ToggleButton>
      <p>brushRadius: {brushRadius}</p>
      <ColorPicker
        name="colour"
        defaultValue={brushColour}
        onChange={(colour) => {
          setBrushColour(colour);
          console.log(brushColour);
        }}
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
        <Button variant="contained" color="primary" onClick={saveImage}>
          Save
        </Button>
      </p>
      <p>
        <Button variant="contained" color="secondary" onClick={clearCanvas}>
          Clear
        </Button>
      </p>
      <canvas
        ref={canvasRef}
        height={getProp("canvasSize")}
        width={getProp("canvasSize")}
        onMouseDown={(e) =>
          startPaint(
            e.clientX,
            e.clientY,
            (e.target as HTMLCanvasElement).getContext("2d")
          )
        }
        onMouseMove={(e) =>
          paint(
            e.clientX,
            e.clientY,
            (e.target as HTMLCanvasElement).getContext("2d")
          )
        }
        onWheel={handleCanvasWheel}
        onMouseUp={endPaint}
        onMouseLeave={endPaint}
        onTouchStart={(e) =>
          startPaint(
            e.changedTouches[0].clientX,
            e.changedTouches[0].clientY,
            (e.target as HTMLCanvasElement).getContext("2d")
          )
        }
        onTouchMove={(e) =>
          paint(
            e.changedTouches[0].clientX,
            e.changedTouches[0].clientY,
            (e.target as HTMLCanvasElement).getContext("2d")
          )
        }
        onTouchEnd={endPaint}
        onContextMenu={(e) => e.preventDefault()}
      />
      <canvas
        ref={canvasRef2}
        height={getProp("canvasSize")}
        width={getProp("canvasSize")}
        onContextMenu={(e) => e.preventDefault()}
      ></canvas>
    </div>
  );
}

export default App;
