import { useRef, useEffect } from "react";
import { debug } from "./util";
export interface Stroke {
  colour: string;
  brushRadius: number;
  points: Array<[number, number]>;
}

export interface Props {
  displayedHistory: Stroke[];
  brushRadius?: number;
  brushColour?: string;
  eraseMode?: boolean;
  locked?: boolean;
  onStrokeDone?: (currentStroke: Stroke) => void;
}

const defaultProps: any = {
  displayedHistory: [],
  brushRadius: 5,
  brushColour: "black",
  eraseMode: false,
  locked: false,
  onStrokeDone: () => {},
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

  const displayedHistory = getProp("displayedHistory"); // previously forcedHistory

  const brushColour = getProp("brushColour");
  const brushRadius = getProp("brushRadius");
  const eraseMode = getProp("eraseMode");
  const isLocked = getProp("locked");

  const onStrokeDone = getProp("onStrokeDone");

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas")),
    secondCanvasRef = useRef<HTMLCanvasElement>(
      document.createElement("canvas")
    ),
    drawMode = useRef(false);

  /**
   * Converts client coords (mouse/touch) to canvas-rel coords
   *
   * @param {number} x x coord rel to client
   * @param {number} x y coord rel to client
   */
  function convertCoords(x: number, y: number) {
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = Math.floor(x - rect.left); // ts actually caught me using parseInt instead of Math.floor/toFixed... heh.
    const canvasY = Math.floor(y - rect.top);
    return [canvasX, canvasY];
  }

  function handlePaintStart(x: number, y: number) {
    //console.log("handlePaintStart");
    if (drawMode.current) return;

    drawMode.current = true;

    const [canvasX, canvasY] = convertCoords(x, y);

    currentStroke.current = {
      // start tracking stroke
      colour: eraseMode ? "#ffffff" : brushColour,
      brushRadius: brushRadius,
      points: [[canvasX, canvasY]],
    };

    drawOnCanvas();
  }

  function handlePaint(x: number, y: number) {
    //console.log("handlePaint");
    currentStroke.current = {
      // append canvasXY to current stroke
      ...currentStroke.current,
      points: [...currentStroke.current.points, [x, y]],
    };

    drawOnCanvas();
  }

  const handleMove = (x: number, y: number) => {
    const [canvasX, canvasY] = convertCoords(x, y);

    if (drawMode.current) {
      handlePaint(canvasX, canvasY);
    }

    // draw cursor indicator on overlay
    const ctx = secondCanvasRef.current.getContext("2d");
    if (ctx !== null) {
      //debug("Drawing", x, y, brushColour);
      ctx.clearRect(0, 0, 400, 400);
      ctx.beginPath();
      //ctx.fillStyle = brushColour;
      ctx.strokeStyle = "#000";
      ctx.arc(canvasX, canvasY, brushRadius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  function handlePaintEnd(e: React.UIEvent) {
    e.preventDefault();
    //console.log("handlePaintEnd");
    if (drawMode.current) {
      drawMode.current = false;
      onStrokeDone(currentStroke.current);
    }
  }

  const handleLeave = (e: React.UIEvent) => {
    handlePaintEnd(e);
    const ctx = secondCanvasRef.current.getContext("2d");
    if (ctx !== null) ctx.clearRect(0, 0, 400, 400); // clear overlay
  };

  /**
   * Draws strokes on the canvas
   *
   * @param {Stroke=currentStroke} stroke The stroke to draw
   * @param {boolean=true} lastPointOnly Whether to draw the stroke's last point, or all its points
   */
  function drawOnCanvas(
    stroke: Stroke = currentStroke.current,
    lastPointOnly = true
  ) {
    const ctx = canvasRef.current.getContext("2d");
    if (ctx === null || !stroke || !stroke.points) {
      return;
    } else if (stroke.points.length === 1) {
      // draw circle at initial point
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
      for (
        let i = lastPointOnly ? stroke.points.length - 2 : 0; // jump to second-last point if lastPointOnly
        i < stroke.points.length - 1;
        i++
      ) {
        ctx.moveTo(stroke.points[i][0], stroke.points[i][1]);
        ctx.lineTo(stroke.points[i + 1][0], stroke.points[i + 1][1]);
      }
      ctx.stroke();
    }
  }

  useEffect(() => {
    //clear and redraw on displayedHistory change
    const ctx = canvasRef.current.getContext("2d");
    if (ctx !== null) ctx.clearRect(0, 0, 400, 400);
    displayedHistory.forEach((stroke: Stroke) => drawOnCanvas(stroke, false)); //manually call draw function
    debug("Canvas redrew");
  }, [displayedHistory]);

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        height={400}
        width={400}
        style={{
          position: "absolute",
          top: "0px",
          left: "0px",
          zIndex: 0,
          backgroundColor: "transparent",
          imageRendering: "pixelated",
        }} // enabled touch scrolling if canvas is locked
      />
      <canvas
        ref={secondCanvasRef}
        height={400}
        width={400}
        style={{
          position: "absolute",
          top: "0px",
          left: "0px",
          zIndex: 1,
          touchAction: isLocked ? "auto" : "none",
          imageRendering: "pixelated",
        }}
        {...(isLocked // do not register event listeners if isLocked
          ? {}
          : {
              onMouseDown: (e) => handlePaintStart(e.clientX, e.clientY),
              onMouseMove: (e) => handleMove(e.clientX, e.clientY),
              onMouseUp: handlePaintEnd,
              onMouseLeave: handleLeave,
              onTouchStart: (e) => {
                e.preventDefault();
                handlePaintStart(
                  e.changedTouches[0].clientX,
                  e.changedTouches[0].clientY
                );
              },
              onTouchMove: (e) => {
                e.preventDefault();
                handleMove(
                  e.changedTouches[0].clientX,
                  e.changedTouches[0].clientY
                );
              },
              onTouchEnd: handlePaintEnd,
              onTouchCancel: handlePaintEnd,
            })}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

export default Canvas;
