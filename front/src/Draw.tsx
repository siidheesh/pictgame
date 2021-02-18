import React, { useState, useRef, useMemo } from "react";
import {
  Button,
  ButtonGroup,
  Dialog,
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
import { logo } from "./LogoWrapper";
import { serialiseStrokes, debug, hexToRgb } from "./util";

interface DrawProps {
  [key: string]: any;
}

// TODO: replace canvas overlay with a circle in the cursor svg itself
const getBrushCursor = (brushColour: string) =>
  `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="24px" height="24px" viewBox="0 0 347.523 347.523" data-reactroot=""><g><g><path d="M108.674,196.125c-2.857-0.402-5.777-0.592-8.746-0.534c-14.267,0.278-36.342,6.092-60.493,32.207 c-19.171,20.729-19.954,42.635-20.644,61.961c-0.66,18.474-1.181,33.065-16.507,43.727c-1.506,1.049-2.318,2.837-2.113,4.661 c0.128,1.147,0.645,2.191,1.434,2.98c0.466,0.466,1.026,0.843,1.658,1.099c28.523,11.553,77.316,5.895,117.044-33.833 c18.043-18.044,28.812-37.145,31.14-55.233c0.607-4.719,0.618-9.323,0.091-13.763L108.674,196.125z M100.915,229.382 c-1.553,2.174-3.859,3.612-6.494,4.052c-19.209,3.202-25.884,15.953-26.159,16.494c-1.627,3.387-5.167,5.611-8.989,5.611 c-0.337,0-0.676-0.017-1.015-0.052c-1.149-0.117-2.264-0.432-3.313-0.936c-4.97-2.391-7.069-8.376-4.681-13.347 c0.442-0.918,11.153-22.546,40.869-27.5c0.546-0.09,1.1-0.136,1.647-0.136c4.908,0,9.055,3.516,9.861,8.357 C103.08,224.559,102.467,227.207,100.915,229.382z" style="fill:${hexToRgb(
    brushColour
  )}"></path><path d="M340.587,6.796c-8.615-8.614-22.425-9.1-31.624-1.112c-5.782,5.021-141.818,123.166-160.166,141.513 c-9.175,9.175-20.946,24.898-31.124,39.428l42.864,43.271c14.546-10.18,30.345-22.003,39.65-31.308 C218.749,180.024,336.69,44.193,341.703,38.42C349.688,29.22,349.201,15.41,340.587,6.796z" style="fill:brown"></path></g></g></svg>`;

const PublishConfirmation = React.memo((props: any) => (
  <Dialog open={props.open} aria-labelledby="" aria-describedby="">
    <div className="center m20">
      <div className="center-text mb10">
        <Typography variant="h6">
          Your drawing will be stored and randomly shown on the front page!
        </Typography>
      </div>
      <Typography variant="h5">Do you accept?</Typography>
      <div className="center-row wrap mt10">
        <Button onClick={props.onAccept}>✅</Button>
        <Button onClick={props.onReject}>❌</Button>
      </div>
    </div>
  </Dialog>
));

const defaultProps: DrawProps = {
  brushRadius: 5,
  brushRadiusMin: 1,
  brushRadiusMax: 20,
  brushRadiusStep: 1,
  brushRadiusSmall: 3,
  brushColour: "#000",
  onSubmit: null,
  onQuit: () => {},
  onDrawingChanged: () => {},
  displayedHistory: logo,
  onShare: () => {},
  published: true,
};

const Draw = (props: DrawProps) => {
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

  // the strokes currently displayed (previously forcedHistory)
  const displayedHistory: Stroke[] = getProp("displayedHistory");
  const [strokeHistory, setStrokeHistory] = useState(
    getProp("displayedHistory") as Stroke[]
  ); // the strokes currently tracked (undo/redo)

  const [description, setDescription] = useState("");
  const [inputValid, setInputValid] = useState({ description: false });
  const [showPubMsg, setShowPubMsg] = useState(false);
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

  const onSubmit = getProp("onSubmit"),
    onQuit = getProp("onQuit"),
    onDrawingChanged = getProp("onDrawingChanged"),
    onShare = getProp("onShare"),
    published = getProp("published");

  const handleSubmit = () => {
    // BUG: need to preprocess displayedHistory to remove out-of-bounds points
    if (inputValid.description && onSubmit)
      onSubmit({
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
    onDrawingChanged(sliceHistory());
  };

  const handleRedo = () => {
    undoLevel.current = Math.max(0, undoLevel.current - 1);
    debug("handleRedo", undoLevel.current);
    onDrawingChanged(sliceHistory());
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
    onDrawingChanged([] as Stroke[]);
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
    onDrawingChanged(newHistory);
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
    onDrawingChanged(newHistory);
  };

  debug("Draw render");

  return (
    <div className="center header-padding">
      <PublishConfirmation
        open={showPubMsg}
        onAccept={() => {
          onShare();
          setShowPubMsg(false);
        }}
        onReject={() => setShowPubMsg(false)}
      />
      <div className="center-text mb50">
        <Typography variant="h5">
          Draw something for {getProp("name")} 🎨
        </Typography>
      </div>
      <div
        className="center mb20"
        style={{
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
      <div className="center-row wrap mt10 mb10">
        <div className="p5">
          <ColourPicker
            color={brushColour}
            onChangeComplete={(colour, _) => handleColorChange(colour.hex)}
          />
        </div>
        <ButtonGroup className="p5">
          <Tooltip
            title={dragMode ? "Stop dragging" : "Start dragging"}
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
      {onSubmit && (
        <div className="center-text mb10">
          <div className="mb10">
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
            disabled={!displayedHistory.length} // prevent huge layout shift
            error={!inputValid.description}
            onKeyDown={handleKeyDown} //https://stackoverflow.com/questions/22473950/keypress-event-not-firing-in-android-mobile
          />
        </div>
      )}
      {!onSubmit && displayedHistory.length > 0 && (
        <Button onClick={() => setShowPubMsg(true)} disabled={published}>
          Publish my drawing
        </Button>
      )}
      <Button onClick={onQuit}>Quit</Button>
    </div>
  );
};

export default Draw;
