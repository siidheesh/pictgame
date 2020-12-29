import { MutableRefObject, useState, useRef, useEffect } from "react";


export interface Stroke {
    colour: string;
    brushRadius: number;
    points: Array<[number, number]>;
  };
  
export interface Props {
  strokeHistory: MutableRefObject<Stroke[]>,
  onStrokeHistoryChange: (_: Stroke[]) => void,//React.Dispatch<React.SetStateAction<Stroke[]>>;
  forcedHistory: Stroke[],
  brushRadius: number,
  brushColour: string,
  eraseMode: boolean
};

/**
 * Component for a canvas to draw and show drawings on
 *
 * @component
 */
function Canvas(props: Props) {
 
  const [currentStroke, setCurrentStroke] = useState({} as Stroke);

  const strokeHistory = props.strokeHistory;
  const setStrokeHistory = props.onStrokeHistoryChange;
  const forcedHistory = props.forcedHistory;
  
  const brushColour = props.brushColour;
  const brushRadius = props.brushRadius;
  const eraseMode = props.eraseMode;

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas")),
        lastX = useRef(0),
        lastY = useRef(0),
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

  function handlePaintStart(
    x: number,
    y: number,
    ctx: CanvasRenderingContext2D | null
  ) {
    //console.log("handlePaintStart");
    if (drawMode.current || ctx === null) return;

    drawMode.current = true;

    const [canvasX, canvasY] = convertCoords(x, y);
    lastX.current = canvasX;
    lastY.current = canvasY;

    setCurrentStroke({
      // start tracking stroke
      colour: eraseMode ? '#ffffff' : brushColour,
      brushRadius: brushRadius,
      points: [[canvasX, canvasY]],
    });
  }

  function handlePaint(
    x: number,
    y: number,
    ctx: CanvasRenderingContext2D | null
  ) {
    //console.log("handlePaint");
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
    //console.log("handlePaintEnd");
    if (!drawMode.current) return;
    drawMode.current = false;
    if (currentStroke)
      setStrokeHistory([
        // store the tracked stroke
        ...strokeHistory.current,
        currentStroke,
      ]);
    setCurrentStroke({} as Stroke);
  }

  /**
   * Draws strokes on the canvas
   *
   * @param {Stroke=currentStroke} stroke The stroke to draw
   * @param {boolean=true} lastPointOnly Whether to draw the stroke's last point, or all its points
   */
  function drawOnCanvas(stroke: Stroke = currentStroke, lastPointOnly = true) {
    //
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

  useEffect(drawOnCanvas, [currentStroke]); // drawOnCanvas on currentStroke change

  useEffect(() => console.log("*****************RENDER**************"));

  useEffect(() => {
    //clear and redraw on forcedHistory change
    console.log("FORCED HISTORY REDRAW**************************");
    console.log(forcedHistory);
    const ctx = canvasRef.current.getContext("2d");
    if (ctx !== null) ctx.clearRect(0, 0, 400, 400);
    forcedHistory.forEach((stroke) => drawOnCanvas(stroke, false)); //manually call draw function
    setStrokeHistory(forcedHistory);
  }, [forcedHistory]);

  return (
    <div className="canvas1">
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
