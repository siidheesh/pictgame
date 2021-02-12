import React, { useRef, useEffect, useCallback } from "react";
import { Paper } from "@material-ui/core";
import { debug, getRandInRange } from "./util";

export type Point = [number, number];
export interface Stroke {
  colour: string;
  brushRadius: number;
  points: Array<Point>;
  size: number;
}

export interface Props {
  displayedHistory: Stroke[];
  brushRadius?: number;
  brushColour?: string;
  eraseMode?: boolean;
  locked?: boolean;
  onStrokeDone?: (currentStroke: Stroke) => void;
  size?: number;
  animated?: boolean;
}

const defaultProps: any = {
  displayedHistory: [],
  brushRadius: 5,
  brushColour: "#000",
  eraseMode: false,
  locked: false,
  onStrokeDone: () => {},
  size: 400,
  animated: false,
};

/**
 * Draws strokes on the canvas
 * @param {CanvasRenderingContext2D | null} canvasRef The canvas' 2D context
 * @param {Stroke} stroke The stroke to draw
 * @param {number} size The current canvas size
 * @param {boolean} [lastPointOnly=true] Whether to draw the stroke's last point, or all its points
 */
const drawOnCanvas = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  size: number,
  lastPointOnly = true
) => {
  if (!stroke?.points) return;

  const ratio = size / stroke.size;
  const scale = (x: number) => Math.floor(x * ratio);
  const scalePoint = (p: Point): Point => [scale(p[0]), scale(p[1])];
  const radius = Math.max(1, scale(stroke.brushRadius));

  if (stroke.points.length === 1) {
    // draw circle at initial point
    const point = scalePoint(stroke.points[0]);
    ctx.beginPath();
    ctx.fillStyle = stroke.colour;
    ctx.arc(point[0], point[1], radius, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    ctx.lineWidth = radius * 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = stroke.colour;

    ctx.beginPath();
    for (
      let i = lastPointOnly ? stroke.points.length - 2 : 0; // jump to second-last point if lastPointOnly
      i < stroke.points.length - 1;
      i++
    ) {
      const point0 = scalePoint(stroke.points[i]),
        point1 = scalePoint(stroke.points[i + 1]);
      ctx.moveTo(point0[0], point0[1]);
      ctx.lineTo(point1[0], point1[1]);
    }
    ctx.stroke();
  }
};

/**
 * Component for a canvas to draw and show drawings on
 *
 * @component
 */
function Canvas(props: any) {
  const getProp = (prop: string) =>
    props[prop] ?? defaultProps[prop] ?? undefined;

  const currentStroke = useRef({} as Stroke);

  const displayedHistory: Stroke[] = getProp("displayedHistory"); // previously forcedHistory

  const size = getProp("size");
  const brushColour = getProp("brushColour");
  const brushRadius = getProp("brushRadius");
  const eraseMode = getProp("eraseMode");
  const isLocked = getProp("locked");
  const animated = getProp("animated");

  const onStrokeDone = getProp("onStrokeDone");

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas")),
    overlayRef = useRef<HTMLCanvasElement>(document.createElement("canvas")),
    drawMode = useRef(false),
    animState = useRef({
      rafRef: 0,
      strokeIdx: 0,
      pointIdx: 0,
      lastCalled: 0,
      currentDelay: 0,
      initialDelay: 0,
    });

  /**
   * Converts client coords (mouse/touch) to canvas-rel coords
   *
   * @param {number} x x coord rel to client
   * @param {number} x y coord rel to client
   */
  function convertCoords(x: number, y: number): Point {
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = Math.floor(x - rect.left); // ts actually caught me using parseInt instead of Math.floor/toFixed... heh.
    const canvasY = Math.floor(y - rect.top);
    return [canvasX, canvasY];
  }

  function handlePaintStart(x: number, y: number) {
    //console.log("handlePaintStart");
    if (drawMode.current) return;

    drawMode.current = true;

    currentStroke.current = {
      // start tracking stroke
      colour: eraseMode ? "#ffffff" : brushColour,
      brushRadius: brushRadius,
      points: [convertCoords(x, y)],
      size,
    };

    const ctx = canvasRef.current?.getContext("2d", { alpha: false });
    if (ctx) drawOnCanvas(ctx, currentStroke.current, size);
  }

  function handlePaint(x: number, y: number, drawOverlay = true) {
    //console.log("handlePaint");
    const canvasXY = convertCoords(x, y);

    if (drawMode.current) {
      const prevPoint =
        currentStroke.current.points[currentStroke.current.points.length - 1];
      // ignore points that are sufficiently close, to save space
      // TODO: track all points here, write a wasm module to remove them before exporting thr pic
      if (
        (prevPoint[0] - canvasXY[0]) ** 2 + (prevPoint[1] - canvasXY[1]) ** 2 >=
        currentStroke.current.brushRadius ** 1
      ) {
        currentStroke.current = {
          // append canvasXY to current stroke
          ...currentStroke.current,
          points: [...currentStroke.current.points, canvasXY],
        };
        const ctx = canvasRef.current?.getContext("2d", { alpha: false });
        if (ctx) drawOnCanvas(ctx, currentStroke.current, size);
      }
    }

    if (drawOverlay) {
      // draw cursor indicator on overlay
      const ctx = overlayRef.current?.getContext("2d", { alpha: true });
      if (ctx) {
        //debug("Drawing", x, y, brushColour);
        ctx.clearRect(0, 0, size, size);
        ctx.beginPath();
        ctx.strokeStyle = "#000";
        ctx.arc(canvasXY[0], canvasXY[1], brushRadius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  }

  function handlePaintEnd(e: React.UIEvent, clearOverlay = false) {
    e.preventDefault();
    //console.log("handlePaintEnd");
    if (drawMode.current) {
      drawMode.current = false;
      onStrokeDone(currentStroke.current);
    }

    if (clearOverlay) {
      const ctx = overlayRef.current?.getContext("2d", { alpha: true }); // has to be transparent
      if (ctx) ctx.clearRect(0, 0, size, size); // clear overlay
    }
  }

  // TODO: refactor the painting logic out of this
  const frameLoop = useCallback(
    (time: number) => {
      if (!animState.current.lastCalled) {
        animState.current.lastCalled = time;
        animState.current.currentDelay = animState.current.initialDelay;
      } else if (
        time - animState.current.lastCalled >=
        animState.current.currentDelay
      ) {
        animState.current.lastCalled = time;

        const stroke = displayedHistory[animState.current.strokeIdx];
        if (!stroke) return;

        const point =
          displayedHistory[animState.current.strokeIdx].points[
            animState.current.pointIdx
          ];
        if (!point) return;

        const ctx = canvasRef.current?.getContext("2d", { alpha: false });

        if (ctx) {
          const ratio = size / stroke.size;
          const scale = (x: number) => Math.floor(x * ratio);
          const scalePoint = (p: Point): Point => [scale(p[0]), scale(p[1])];
          const radius = Math.max(1, scale(stroke.brushRadius));
          const currentPoint = scalePoint(point);

          if (stroke.points.length === 1 || animState.current.pointIdx === 0) {
            ctx.beginPath();
            ctx.fillStyle = stroke.colour;
            ctx.arc(currentPoint[0], currentPoint[1], radius, 0, 2 * Math.PI);
            ctx.fill();
          } else {
            ctx.lineWidth = radius * 2;
            ctx.lineCap = "round";
            ctx.strokeStyle = stroke.colour;
            ctx.beginPath();
            const prevPoint = scalePoint(
              displayedHistory[animState.current.strokeIdx].points[
                animState.current.pointIdx - 1
              ]
            ); // should never be nullish
            ctx.moveTo(prevPoint[0], prevPoint[1]);
            ctx.lineTo(currentPoint[0], currentPoint[1]);
            ctx.stroke();
          }
        }

        animState.current.pointIdx += 1;

        if (animState.current.pointIdx >= stroke.points.length) {
          // move to next stroke
          animState.current.pointIdx = 0;
          animState.current.strokeIdx += 1;
          animState.current.currentDelay = getRandInRange(160, 240);
        } else animState.current.currentDelay = getRandInRange(0, 32);

        if (animState.current.strokeIdx >= displayedHistory.length) {
          // no more strokes
          return;
        }
      }
      animState.current.rafRef = requestAnimationFrame(frameLoop);
    },
    [displayedHistory, size]
  );

  useEffect(() => {
    //clear and redraw on displayedHistory/size/animated change
    const ctx = canvasRef.current?.getContext("2d", { alpha: false });
    if (ctx) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);

      if (!animated) {
        displayedHistory.forEach((stroke: Stroke) =>
          drawOnCanvas(ctx, stroke, size, false)
        ); //manually call draw function
      } else {
        animState.current = {
          rafRef: 0,
          strokeIdx: 0,
          pointIdx: 0,
          lastCalled: 0,
          currentDelay: 0,
          initialDelay: getRandInRange(160, 240),
        };
        animState.current.rafRef = window.requestAnimationFrame(frameLoop);
        return () => window.cancelAnimationFrame(animState.current.rafRef);
      }

      debug("Canvas redrew");
    }
  }, [displayedHistory, size, animated, frameLoop]);

  return (
    <Paper
      elevation={6}
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        transform: "translateZ(0px)",
      }}
    >
      <canvas
        ref={canvasRef}
        height={size}
        width={size}
        style={{
          position: "absolute",
          top: "0px",
          left: "0px",
          zIndex: 0,
          backgroundColor: "white",
        }}
      />
      <canvas
        ref={overlayRef}
        height={size}
        width={size}
        style={{
          position: "absolute",
          top: "0px",
          left: "0px",
          zIndex: 1,
          touchAction: isLocked ? "auto" : "none", // enabled touch scrolling if canvas is locked
        }}
        {...(isLocked // do not register event listeners if isLocked
          ? {}
          : {
              onMouseDown: (e) => handlePaintStart(e.clientX, e.clientY),
              onMouseMove: (e) => handlePaint(e.clientX, e.clientY),
              onMouseUp: handlePaintEnd,
              onMouseLeave: (e) => handlePaintEnd(e, true),
              onTouchStart: (e) =>
                handlePaintStart(
                  e.changedTouches[0].clientX,
                  e.changedTouches[0].clientY
                ),
              onTouchMove: (e) =>
                handlePaint(
                  e.changedTouches[0].clientX,
                  e.changedTouches[0].clientY,
                  false
                ),
              onTouchEnd: handlePaintEnd,
              onTouchCancel: handlePaintEnd,
            })}
        onContextMenu={(e) => e.preventDefault()}
      />
    </Paper>
  );
}

export default Canvas;
