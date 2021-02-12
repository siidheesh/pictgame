import React, { useRef, useEffect, useCallback } from "react";
import { Paper } from "@material-ui/core";
import { debug, getRandInRange } from "./util";

export type Point = [number, number];
export type Vector = [number, number];
export interface Stroke {
  colour: string;
  brushRadius: number;
  points: Array<Point>;
  size: number;
}
interface StrokeIndexes {
  [key: number]: boolean;
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
  dragMode: true,
  onAnimDone: () => {},
  onDragDone: undefined, // restore canvas if undefined
};

/**
 * Converts client coords (mouse/touch) to canvas-rel coords
 *
 * @param {React.MutableRefObject<HTMLCanvasElement>} canvasRef the ref to the canvas
 * @param {number} x x coord rel to client
 * @param {number} x y coord rel to client
 */
function convertCoords(
  canvasRef: React.MutableRefObject<HTMLCanvasElement>,
  x: number,
  y: number
): Point {
  const rect = canvasRef.current.getBoundingClientRect();
  const canvasX = Math.floor(x - rect.left); // ts actually caught me using parseInt instead of Math.floor/toFixed... heh.
  const canvasY = Math.floor(y - rect.top);
  return [canvasX, canvasY];
}

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
 * Squared euclidian distance between two Points
 * @param {Point} p1 Point 1
 * @param {Point} p2 Point 2
 */
const euclideanDistSqrd = (p1: Point, p2: Point) =>
  (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2;

/**
 * Check if a point is contained within a stroke
 * @param {Point} test The point in question
 * @param {Stroke} stroke The stroke in question
 * @param {number} size The current canvas size
 */
const pointInStroke = (test: Point, stroke: Stroke, size: number) => {
  const points = stroke?.points;
  if (!points) return false;

  const ratio = size / stroke.size;
  const scale = (x: number) => Math.floor(x * ratio);
  const scalePoint = (p: Point): Point => [scale(p[0]), scale(p[1])];
  const radius = Math.max(1, scale(stroke.brushRadius + 5));
  const radiusSquared = radius ** 2;
  const p0 = scalePoint(points[0]);

  if (points.length === 1) {
    return euclideanDistSqrd(test, p0) <= radiusSquared;
  } else {
    // check if test is within radius of a stroke point
    let topLeft: Point = [p0[0], p0[1]],
      bottomRight: Point = [p0[0], p0[1]];
    for (let i = 0; i < points.length; i++) {
      const sp = scalePoint(points[i]);
      if (euclideanDistSqrd(test, sp) <= radiusSquared) return true;
      // update stroke's bounding box
      topLeft = [Math.min(topLeft[0], sp[0]), Math.min(topLeft[1], sp[1])];
      bottomRight = [
        Math.max(bottomRight[0], sp[0]),
        Math.max(bottomRight[1], sp[1]),
      ];
    }
    // test point within bounding box of stroke
    return (
      topLeft[0] <= test[0] &&
      test[0] <= bottomRight[0] &&
      topLeft[1] <= test[1] &&
      test[1] <= bottomRight[1]
    );
    /*
    // code that checks each segment, returning if it contains the test point
      for (let i = 0; i < points.length - 1; i++) {
        const [startPoint, endPoint] =
          points[i][0] < points[i + 1][0]
            ? [points[i], points[i + 1]]
            : [points[i + 1], points[i]];
        // now, startPoint <= endPoint
        if (startPoint[0] <= test[0] && test[0] <= endPoint[0]) {
          // startPoint.x <= text.x <= endPoint.x
          debug(idx, "start <= test <= end", test);
          const m =
            (endPoint[1] - startPoint[1]) / (endPoint[0] - startPoint[0]);
          const centreY = startPoint[1] + m * test[0];
          return centreY - radius <= test[1] && test[1] <= centreY + radius; // test.y is within `radius` of centreY
        }
      }*/
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
  const dragMode = getProp("dragMode");

  const onStrokeDone = getProp("onStrokeDone");
  const onDragDone = getProp("onDragDone");
  const onAnimDone = getProp("onAnimDone");

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
    }),
    selectedStrokes = useRef({
      strokes: {} as StrokeIndexes,
      point: [0, 0] as Point,
    }),
    draggedHistory = useRef([] as Stroke[]);

  function handlePaintStart(x: number, y: number) {
    //console.log("handlePaintStart");
    const canvasXY = convertCoords(canvasRef, x, y);
    if (!drawMode.current) {
      drawMode.current = true;

      if (dragMode) {
        // store a copy of displayedHistory
        draggedHistory.current = JSON.parse(JSON.stringify(displayedHistory));
        // keep track of strokes under cursor position
        selectedStrokes.current = {
          strokes: draggedHistory.current.reduceRight(
            (acc, stroke, idx) =>
              !Object.keys(acc).length && // only drag the latest stroke for now
              pointInStroke(canvasXY, stroke, size)
                ? { ...acc, [idx]: true }
                : acc,
            {}
          ),
          point: canvasXY,
        };
      } else {
        currentStroke.current = {
          // start tracking stroke
          colour: eraseMode ? "#ffffff" : brushColour,
          brushRadius: brushRadius,
          points: [canvasXY],
          size,
        };

        const ctx = canvasRef.current?.getContext("2d", { alpha: false });
        if (ctx) drawOnCanvas(ctx, currentStroke.current, size);
      }
    }
  }

  function handlePaint(x: number, y: number, drawOverlay = true) {
    //console.log("handlePaint");
    const canvasXY = convertCoords(canvasRef, x, y);
    if (drawMode.current) {
      if (dragMode) {
        if (
          !selectedStrokes.current?.point ||
          !selectedStrokes.current?.strokes
        )
          return;
        // calculate displacement
        const dp = ((p1: Point, p2: Point): Vector => [
          p2[0] - p1[0],
          p2[1] - p1[1],
        ])(selectedStrokes.current.point, canvasXY);

        // loop through each selected stroke
        for (const strokeIdx in selectedStrokes.current.strokes) {
          //reference to the stroke to be moved
          const selectedStroke = draggedHistory.current[strokeIdx];
          // the displacement vector ratio is inverse in this case
          const ratio = selectedStroke.size / size;
          const scale = (x: number) => (ratio === 1 ? x : x * ratio);
          // move each point
          selectedStroke.points = selectedStroke.points.map((p) => [
            p[0] + scale(dp[0]),
            p[1] + scale(dp[1]),
          ]);
          // update reference point
          selectedStrokes.current.point = canvasXY;
          // show aftermath
          const ctx = canvasRef.current?.getContext("2d", { alpha: false });
          if (ctx) {
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, size, size);
            draggedHistory.current.forEach((stroke: Stroke) =>
              drawOnCanvas(ctx, stroke, size, false)
            );
          }
        }
      } else {
        const prevPoint =
          currentStroke.current.points[currentStroke.current.points.length - 1];
        // ignore points that are sufficiently close, to save space
        // TODO: track all points here, write a wasm module to remove them before exporting the pic
        if (
          (prevPoint[0] - canvasXY[0]) ** 2 +
            (prevPoint[1] - canvasXY[1]) ** 2 >=
          currentStroke.current.brushRadius ** 1
        ) {
          currentStroke.current = {
            // append canvasXY to current stroke
            ...currentStroke.current,
            points: [...currentStroke.current.points, canvasXY],
          };
          const ctx = canvasRef.current?.getContext("2d", { alpha: false });
          if (ctx) {
            drawOnCanvas(ctx, currentStroke.current, size);
          }
        }
      }
    }

    if (drawOverlay && !dragMode) {
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
      if (!dragMode) {
        onStrokeDone(currentStroke.current); // inform parent of new stroke
      } else {
        if (selectedStrokes.current.strokes) {
          if (onDragDone) {
            // signal drag op completion
            onDragDone(selectedStrokes.current.strokes, draggedHistory.current);
          } else {
            // no onDragDone handler, clear changes and revert back to displayedHistory
            const ctx = canvasRef.current?.getContext("2d", { alpha: false });
            if (ctx) {
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, size, size);
              displayedHistory.forEach((stroke: Stroke) =>
                drawOnCanvas(ctx, stroke, size, false)
              );
            }
          }
        }
      }
    }

    //if (dragMode) selectedStrokes.current = []; // no need to explicitly clear

    if (clearOverlay && !dragMode) {
      const ctx = overlayRef.current?.getContext("2d", { alpha: true }); // has to be transparent
      if (ctx) ctx.clearRect(0, 0, size, size); // clear overlay
    }
  }

  // TODO: refactor the painting logic out of this
  const handleFrame = useCallback(
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
          onAnimDone();
          return;
        }
      }
      animState.current.rafRef = window.requestAnimationFrame(handleFrame);
    },
    [displayedHistory, size, onAnimDone]
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
          rafRef: window.requestAnimationFrame(handleFrame),
          strokeIdx: 0,
          pointIdx: 0,
          lastCalled: 0,
          currentDelay: 0,
          initialDelay: getRandInRange(160, 240),
        };
        return () => window.cancelAnimationFrame(animState.current.rafRef);
      }

      debug("Canvas redrew");
    }
  }, [displayedHistory, size, animated, handleFrame]);

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
