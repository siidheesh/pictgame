import React, { useState, useRef, useMemo } from "react";
import {
  Button,
  ButtonGroup,
  Slider,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import DeleteIcon from "@material-ui/icons/Delete";
import UndoIcon from "@material-ui/icons/Undo";
import RedoIcon from "@material-ui/icons/Redo";
import PanToolIcon from "@material-ui/icons/PanTool";

import { Icon } from "@iconify/react";
import eraserIcon from "@iconify-icons/mdi/eraser";

import Canvas, { Stroke, processStroke } from "./Canvas";
import { CompactPicker } from "react-color";

import { serialiseStrokes, deserialiseStrokes, debug, hexToRgb } from "./util";

interface DrawProps {
  [key: string]: any;
}

const rawPictgame2 =
  '[["#d33115",4,300,"[[59,73],[59,82],[57,95],[56,111],[56,113]]"],["#d33115",4,300,"[[61,71],[70,64],[78,64],[89,71],[89,79],[84,87],[76,91],[66,90],[62,87]]"],["#e27300",4,300,"[[146,66],[132,67],[125,68],[119,69],[114,70]]"],["#e27300",4,300,"[[129,74],[127,89],[126,97],[126,103],[126,107],[126,109]]"],["#e27300",4,300,"[[139,111],[124,111],[118,111],[114,110],[112,110]]"],["#fcc400",4,300,"[[183,66],[171,71],[163,83],[162,90],[163,98],[168,103],[175,106],[182,107],[186,108]]"],["#68bc00",4,300,"[[239,65],[219,66],[213,66],[209,66],[206,68]]"],["#68bc00",4,300,"[[223,70],[223,80],[222,90],[222,101],[222,112]]"],["#16a5a5",3,300,"[[77,168],[64,173],[59,180],[56,187],[54,194],[53,201],[53,206],[54,210],[58,211],[63,208],[69,203],[74,198],[76,194],[78,197],[78,202],[78,206],[78,209]]"],["#16a5a5",3,300,"[[93,188],[80,191],[75,191],[71,191],[67,190],[65,189]]"],["#009ce0",3,300,"[[101,210],[106,198],[111,191],[115,183],[117,177],[119,172],[120,170],[121,168],[122,166]]"],["#009ce0",3,300,"[[123,167],[127,175],[130,183],[133,191],[135,199],[137,209],[138,211],[137,208]]"],["#009ce0",3,300,"[[134,193],[122,192],[117,193],[114,193],[110,194]]"],["#7b64ff",3,300,"[[164,171],[162,190],[161,202],[161,206],[160,208],[161,206],[162,201],[163,194],[164,186],[165,179],[167,173],[168,169],[171,169],[173,174],[175,181],[176,189],[176,194],[176,197],[176,194],[177,188],[179,181],[182,174],[185,169],[187,168],[189,170],[190,176],[192,186],[193,195],[194,202],[194,206]]"],["#fa28ff",3,300,"[[232,165],[223,165],[221,165],[219,167],[218,169],[218,172],[217,178],[217,184],[216,189],[216,194],[216,198],[216,200],[215,203],[214,205],[219,205],[224,203],[228,203],[231,202],[233,202]]"],["#fa28ff",3,300,"[[234,185],[224,185],[220,184],[217,184]]"],["#000000",2,300,"[[145,254]]"],["#000000",2,300,"[[145,265]]"],["#000000",2,300,"[[156,246],[162,253],[163,255],[163,258],[163,261],[160,268],[158,270],[156,272],[155,273]]"]]';

// TODO: replace canvas overlay with a circle in the cursor svg itself
const getBrushCursor = (brushColour: string) =>
  `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="24px" height="24px" viewBox="0 0 347.523 347.523" data-reactroot=""><g><g><path d="M108.674,196.125c-2.857-0.402-5.777-0.592-8.746-0.534c-14.267,0.278-36.342,6.092-60.493,32.207 c-19.171,20.729-19.954,42.635-20.644,61.961c-0.66,18.474-1.181,33.065-16.507,43.727c-1.506,1.049-2.318,2.837-2.113,4.661 c0.128,1.147,0.645,2.191,1.434,2.98c0.466,0.466,1.026,0.843,1.658,1.099c28.523,11.553,77.316,5.895,117.044-33.833 c18.043-18.044,28.812-37.145,31.14-55.233c0.607-4.719,0.618-9.323,0.091-13.763L108.674,196.125z M100.915,229.382 c-1.553,2.174-3.859,3.612-6.494,4.052c-19.209,3.202-25.884,15.953-26.159,16.494c-1.627,3.387-5.167,5.611-8.989,5.611 c-0.337,0-0.676-0.017-1.015-0.052c-1.149-0.117-2.264-0.432-3.313-0.936c-4.97-2.391-7.069-8.376-4.681-13.347 c0.442-0.918,11.153-22.546,40.869-27.5c0.546-0.09,1.1-0.136,1.647-0.136c4.908,0,9.055,3.516,9.861,8.357 C103.08,224.559,102.467,227.207,100.915,229.382z" style="fill:${hexToRgb(
    brushColour
  )}"></path><path d="M340.587,6.796c-8.615-8.614-22.425-9.1-31.624-1.112c-5.782,5.021-141.818,123.166-160.166,141.513 c-9.175,9.175-20.946,24.898-31.124,39.428l42.864,43.271c14.546-10.18,30.345-22.003,39.65-31.308 C218.749,180.024,336.69,44.193,341.703,38.42C349.688,29.22,349.201,15.41,340.587,6.796z" style="fill:brown"></path></g></g></svg>`;

const Draw = (props: DrawProps) => {
  const defaultProps: DrawProps = {
    brushRadius: 5,
    brushRadiusMin: 1,
    brushRadiusMax: 20,
    brushRadiusStep: 1,
    brushRadiusSmall: 3,
    brushColour: "#000",
    onSubmit: () => {},
  };
  const getProp = (propName: string) => {
    return props[propName] ?? defaultProps[propName];
  };

  const deviceIsSmall = useMediaQuery("(max-width:600px)", { noSsr: true });

  const [eraseMode, setEraseMode] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const [brushColour, setBrushColour] = useState(getProp("brushColour"));
  const [brushRadius, setbrushRadius] = useState(
    deviceIsSmall ? getProp("brushRadiusSmall") : getProp("brushRadius")
  );

  const defaultPic = useMemo(
    () => deserialiseStrokes(JSON.parse(rawPictgame2)),
    []
  );
  const [displayedHistory, setDisplayedHistory] = useState(defaultPic); // the strokes currently displayed (previously forcedHistory)
  const [strokeHistory, setStrokeHistory] = useState(defaultPic); // the strokes currently tracked (undo/redo)

  const [description, setDescription] = useState("");
  const [inputValid, setInputValid] = useState({ description: false });

  const undoLevel = useRef(0);

  // refresh brushCursor on colour change
  // useMemo calls this twice on strictMode/dev, apparently its a testing feature
  const brushCursor = useMemo(() => getBrushCursor(brushColour), [brushColour]);

  const handleColorChange = (colour: string) => setBrushColour(colour);
  const ColourPicker = CompactPicker;

  const handleDescChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newDesc = e.target.value;
    setDescription(newDesc);
    setInputValid({ description: !!newDesc });
  };

  const handleSubmit = () => {
    // BUG: need to preprocess displayedHistory to remove out-of-bounds points
    if (inputValid.description /*&& displayedHistory.length > 0*/)
      getProp("onSubmit")({
        pic: displayedHistory.flatMap(processStroke),
        label: description,
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e?.key === "Enter" || e?.code === "Enter" || e?.keyCode === 13) {
      handleSubmit();
    }
  };

  const sliceHistory = () =>
    strokeHistory.slice(0, strokeHistory.length - undoLevel.current);

  const handleUndo = () => {
    undoLevel.current = Math.min(strokeHistory.length, undoLevel.current + 1);
    debug("handleUndo", undoLevel.current);
    setDisplayedHistory(sliceHistory());
  };

  const handleRedo = () => {
    undoLevel.current = Math.max(0, undoLevel.current - 1);
    debug("handleRedo", undoLevel.current);
    setDisplayedHistory(sliceHistory());
  };

  const handleErase = () => {
    if (undoLevel.current >= strokeHistory.length) {
      undoLevel.current = 0; // the canvas was already cleared by undo-ing
      setStrokeHistory([]); // manually commit
    } else {
      setStrokeHistory(sliceHistory()); // clear future strokes
      undoLevel.current = -1; // a hack to restore previous strokeHistory on undo, if not yet committed
    }
    debug("handleErase", undoLevel.current);
    setDisplayedHistory([]);
  };

  // TODO: refactor all drawing logic into a statemachine
  const handleStrokeDone = (stroke: any) => {
    if (!stroke) return;
    debug("handleStrokeDone");
    let newHistory = [
      ...(undoLevel.current !== -1
        ? undoLevel.current > 0
          ? sliceHistory()
          : strokeHistory
        : []), //  ignore previous strokes when committing an erase
      stroke,
    ];
    undoLevel.current = 0;
    setStrokeHistory(newHistory);
    setDisplayedHistory(newHistory);
  };

  const handleDragDone = (
    strokeIndexes: number[],
    draggedStrokeHistory: Stroke[]
  ) => {
    if (!strokeIndexes || !draggedStrokeHistory) return;
    debug("handleDragDone", strokeIndexes);
    const newHistory = displayedHistory.map((stroke, idx) =>
      strokeIndexes.includes(idx) && idx <= draggedStrokeHistory.length
        ? draggedStrokeHistory[idx]
        : stroke
    );
    setStrokeHistory(newHistory);
    setDisplayedHistory(newHistory);
  };

  debug("Draw render");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        margin: "auto",
        padding: "70px 10px 50px 10px",
        //border: "red dashed",
      }}
      //onWheel={handleScroll}
    >
      <div
        style={{
          marginBottom: "50px",
          textAlign: "center",
        }}
      >
        <Typography variant="h5">
          Draw something for {getProp("name")} 🎨
        </Typography>
      </div>
      <div
        style={{
          margin: "auto",
          display: "flex",
          flexDirection: "column",
          cursor: dragMode
            ? "crosshair"
            : eraseMode
            ? `url("${encodeURI(
                `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'>${eraserIcon.body}</svg>`
              )}") 5 20, auto`
            : `url("${encodeURI(
                `data:image/svg+xml;utf8,${brushCursor}`
              )}") 3 24, auto`,
        }}
      >
        <Canvas
          displayedHistory={displayedHistory}
          brushColour={brushColour}
          brushRadius={brushRadius}
          eraseMode={eraseMode}
          dragMode={dragMode}
          onStrokeDone={handleStrokeDone}
          onDragDone={handleDragDone}
          size={deviceIsSmall ? 300 : 500}
        />
      </div>
      <div style={{ margin: "10px" }} />
      <Slider
        value={brushRadius}
        getAriaValueText={() => "brushRadius"}
        aria-labelledby="discrete-slider-small-steps"
        step={getProp("brushRadiusStep")}
        min={getProp("brushRadiusMin")}
        max={getProp("brushRadiusMax")}
        marks
        valueLabelDisplay="auto"
        onChange={(e, value) => setbrushRadius(value as number)}
      />
      <div
        style={{
          margin: "10px 0px 10px 0",
          display: "flex",
          flexFlow: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ padding: "5px" }}>
          <ColourPicker
            color={brushColour}
            onChangeComplete={(colour, _) => handleColorChange(colour.hex)}
          />
        </div>
        <ButtonGroup style={{ padding: "5px" }}>
          <Tooltip
            title={eraseMode ? "Stop dragging" : "Start dragging"}
            aria-label="drag"
          >
            <ToggleButton
              value="check"
              selected={dragMode}
              onChange={() => setDragMode(!dragMode)}
              //size="large"
            >
              <PanToolIcon />
            </ToggleButton>
          </Tooltip>
          <Tooltip
            title={eraseMode ? "Stop erasing" : "Start erasing"}
            aria-label="erase"
          >
            <ToggleButton
              value="check"
              selected={eraseMode}
              onChange={() => setEraseMode(!eraseMode)}
              size="large"
            >
              <Icon icon={eraserIcon} />
            </ToggleButton>
          </Tooltip>
          <Button onClick={handleErase} disabled={strokeHistory.length <= 0}>
            <DeleteIcon />
          </Button>
          <Button
            onClick={handleUndo}
            disabled={undoLevel.current >= strokeHistory.length}
          >
            <UndoIcon />
          </Button>
          <Button onClick={handleRedo} disabled={undoLevel.current <= 0}>
            <RedoIcon />
          </Button>
        </ButtonGroup>
      </div>
      <div
        style={{
          textAlign: "center",
          marginBottom: "10px",
          visibility: displayedHistory.length > 0 ? "visible" : "hidden",
        }}
      >
        <div style={{ marginBottom: "10px" }}>
          <Typography
            variant="h6"
            onClick={() =>
              debug(JSON.stringify(serialiseStrokes(displayedHistory)))
            }
          >
            What did you draw? 👀
          </Typography>
        </div>
        <TextField
          label="Describe your drawing!"
          variant="outlined"
          value={description}
          onChange={handleDescChange}
          helperText={
            inputValid.description
              ? "(press enter to lock in your drawing)"
              : "Must be filled"
          }
          error={!inputValid.description}
          onKeyDown={handleKeyDown} //https://stackoverflow.com/questions/22473950/keypress-event-not-firing-in-android-mobile
        />
      </div>
    </div>
  );
};

export default Draw;
