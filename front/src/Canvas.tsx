import React, { useState, useRef, useEffect } from "react";
import { Button } from "@material-ui/core";

type Props = { [key: string]: number };
type Stroke = {
  colour: string;
  brushRadius: number;
  points: Array<[number, number]>;
};

function Canvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const [currentStroke, setCurrentStroke] = useState({} as Stroke);
  const [strokeHistory, setStrokeHistory] = useState([] as Stroke[]);

  const lastX = useRef(0),
    lastY = useRef(0),
    drawMode = useRef(false);

  function convertCoords(x: number, y: number) {
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = Math.floor(x - rect.left); // ts actually caught me using parseInt instead of Math.floor/toFixed... heh.
    const canvasY = Math.floor(y - rect.top);
    return [canvasX, canvasY];
  }

  function handlePaintStart(
    x: number,
    y: number,
    ctx: CanvasRenderingContext2D | null
  ) {
    console.log("handlePaintStart");
    if (drawMode.current || ctx === null) return;

    drawMode.current = true;

    const [canvasX, canvasY] = convertCoords(x, y);
    lastX.current = canvasX;
    lastY.current = canvasY;

    setCurrentStroke({
      // start tracking stroke
      colour: ctx.fillStyle as string,
      brushRadius: 5,
      points: [[canvasX, canvasY]],
    });
  }

  function handlePaint(
    x: number,
    y: number,
    ctx: CanvasRenderingContext2D | null
  ) {
    console.log("handlePaint");
    if (!drawMode.current || ctx === null) return;

    const [canvasX, canvasY] = convertCoords(x, y);

    setCurrentStroke({
      // append canvasXY to current stroke
      ...currentStroke,
      points: [...currentStroke.points, [canvasX, canvasY]],
    });

    lastX.current = canvasX;
    lastY.current = canvasY;
  }

  function handlePaintEnd() {
    console.log("handlePaintEnd");
    if (!drawMode.current) return;
    drawMode.current = false;
    if (currentStroke)
      setStrokeHistory([
        // store the tracked stroke
        ...strokeHistory,
        currentStroke,
      ]);
    setCurrentStroke({} as Stroke);
  }

/**
 * Returns x raised to the n-th power.
 *
 * @param {number} x The number to raise.
 * @param {number} n The power, must be a natural number.
 * @return {number} x raised to the n-th power.
 */
  function drawOnCanvas(stroke: Stroke, lastPointOnly=true) { //
    const ctx = canvasRef.current.getContext("2d");
    if (ctx === null || !stroke || !stroke.points) {
        return;
    } else if (stroke.points.length == 1) { // draw circle at initial point
      ctx.beginPath();
      ctx.fillStyle = stroke.colour;
      ctx.arc(
        stroke.points[0][0],
        stroke.points[0][1],
        stroke.brushRadius,
        0,
        2 * Math.PI
      );
      ctx.fill();
    } else {
      ctx.lineWidth = stroke.brushRadius * 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = stroke.colour;
      ctx.beginPath();
      if(lastPointOnly) { // only paint last point
        //ctx.beginPath();
        ctx.moveTo(stroke.points[stroke.points.length - 2][0], stroke.points[stroke.points.length - 2][1]);
        ctx.lineTo(
            stroke.points[stroke.points.length - 1][0],
            stroke.points[stroke.points.length - 1][1]
        );
        //ctx.stroke();
      } else for (let i = 0; i < stroke.points.length - 1; i++) { // paint all points
        //ctx.beginPath();
        ctx.moveTo(stroke.points[i][0], stroke.points[i][1]);
        ctx.lineTo(
            stroke.points[i + 1][0],
            stroke.points[i + 1][1]
        );
        //ctx.stroke();
      }
      ctx.stroke();
    }
  }

  // update canvas element on current stroke
  useEffect(() => drawOnCanvas(currentStroke), [currentStroke]);

  function replayStrokes() {
    console.log(strokeHistory);
    const ctx = canvasRef.current.getContext("2d");
    if (ctx !== null) ctx.clearRect(0, 0, 400, 400);
    const copyStrokeHistory = JSON.parse(
      JSON.stringify(strokeHistory)
    ) as Stroke[];
    copyStrokeHistory.forEach(stroke => drawOnCanvas(stroke, false)); //manually call draw function
    setStrokeHistory(copyStrokeHistory);
  }

  return (
    <div className="canvas1">
      <Button onClick={replayStrokes}>Test replay</Button>
      <canvas
        ref={canvasRef}
        height={400}
        width={400}
        onMouseDown={(e) =>
          handlePaintStart(
            e.clientX,
            e.clientY,
            (e.target as HTMLCanvasElement).getContext("2d")
          )
        }
        onMouseMove={(e) =>
          drawMode.current &&
          handlePaint(
            e.clientX,
            e.clientY,
            (e.target as HTMLCanvasElement).getContext("2d")
          )
        }
        //onWheel={handleCanvasWheel}
        onMouseUp={handlePaintEnd}
        onMouseLeave={handlePaintEnd}
        onTouchStart={(e) =>
          handlePaintStart(
            e.changedTouches[0].clientX,
            e.changedTouches[0].clientY,
            (e.target as HTMLCanvasElement).getContext("2d")
          )
        }
        onTouchMove={(e) =>
          drawMode.current &&
          handlePaint(
            e.changedTouches[0].clientX,
            e.changedTouches[0].clientY,
            (e.target as HTMLCanvasElement).getContext("2d")
          )
        }
        onTouchEnd={handlePaintEnd}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

export default Canvas;
