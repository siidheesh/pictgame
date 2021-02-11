import React, { useState, useRef, useMemo } from "react";
import {
  Button,
  ButtonGroup,
  Paper,
  Slider,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import DeleteIcon from "@material-ui/icons/Delete";
import UndoIcon from "@material-ui/icons/Undo";
import RedoIcon from "@material-ui/icons/Redo";

import { Icon } from "@iconify/react";
import eraserIcon from "@iconify-icons/mdi/eraser";

import Canvas from "./Canvas";
import { CompactPicker } from "react-color";

import { serialiseStrokes, deserialiseStrokes, debug } from "./util";
import { getBrushCursor } from "./brush";

interface DrawProps {
  [key: string]: any;
}

const rawDefaultPic =
  '[["black",5,"AKUArQClAKwApACsAKQArgClAK4="],["black",5,"AKEA5gChAOY="],["black",5,"ANUAmwDVAJsA1gCbANcAmwDYAJsA2ACcANkAnADaAJwA2gCeANsAngDcAJ4A3QCeAN0AnwDdAJ8A3gCgAN8AoADgAKIA4QCiAOEAogDhAKIA4gCjAOMApADkAKQA5QCkAOUApgDlAKYA5QCmAOYApgDmAKcA5wCnAOgAqADpAKgA6QCqAOkAqgDpAKoA6gCqAOoAqwDrAKsA6wCsAOwArADtAK4A7QCuAO0ArgDtAK8A7gCvAO4AsADvALAA8ACyAPAAswDxALMA8QC0APEAtADxALQA8QC1APIAtgDyALcA8gC4APMAuADzALkA9AC6APQAvAD1ALwA9QC9APUAvgD1AL8A9QDAAPUAwAD1AMAA9QDBAPUAwgD2AMMA9gDEAPYAxAD2AMUA9gDGAPYAxwD2AMgA9gDIAPcAygD3AMsA9wDMAPcAzAD3AM0A9wDOAPcAzwD3ANAA9wDQAPcA0QD2ANMA9gDUAPYA1AD2ANUA9gDWAPUA1gD1ANcA9QDYAPUA2AD1ANkA9QDaAPUA2wDzANwA8wDcAPMA3QDzAN0A8wDeAPMA3wDyAOAA8QDhAPEA4gDxAOMA8QDkAO8A5ADvAOQA7wDlAO8A5QDvAOYA7wDnAO4A5wDuAOgA7QDoAO0A6QDtAOkA7QDqAO0A6gDrAOoA6wDsAOsA7ADrAO0A6gDuAOoA7gDpAO4A6QDwAOkA8ADnAPEA5wDyAOcA8gDnAPIA5gD0AOYA9ADlAPQA5QD1AOUA9QDlAPYA4wD4AOMA+ADiAPgA4gD5AOEA+QDhAPoA4QD6AOEA+gDhAPwA4AD8AN8A/ADfAPwA3gD8AN0A/ADdAP0A3AD9ANsA/QDbAP4A2gD+ANkA/gDZAP4A2QD+ANgA/gDXAQAA1gEAANUBAADVAQEA1AEBANQBAgDTAQIA0wECANMBAgDTAQQA1AEE"]]';

const Draw = (props: DrawProps) => {
  const defaultProps: DrawProps = {
    brushRadius: 5,
    brushRadiusMin: 1,
    brushRadiusMax: 20,
    brushRadiusStep: 1,
    brushColour: "black",
    onSubmit: () => {},
  };
  const getProp = (propName: string) => {
    return props[propName] ?? defaultProps[propName];
  };

  const [eraseMode, setEraseMode] = useState(false);
  const [brushColour, setBrushColour] = useState(getProp("brushColour"));
  const [brushRadius, setbrushRadius] = useState(getProp("brushRadius"));

  const defaultPic = useMemo(
    () => deserialiseStrokes(JSON.parse(rawDefaultPic)),
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
    if (inputValid.description /*&& displayedHistory.length > 0*/)
      getProp("onSubmit")({
        pic: displayedHistory,
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
          userSelect: "none",
          textAlign: "center",
        }}
      >
        <Typography variant="h5">
          Draw something for {getProp("name")} 🎨
        </Typography>
      </div>

      <Paper elevation={6} style={{ width: "400px", height: "400px" }}>
        <div
          style={{
            margin: "auto",
            display: "flex",
            flexDirection: "column",
            cursor: eraseMode
              ? `url("${encodeURI(
                  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'>${eraserIcon.body}</svg>`
                )}") 5 20, auto`
              : `url("${encodeURI(
                  `data:image/svg+xml;utf8,${brushCursor}`
                )}") 0 24, auto`,
          }}
        >
          <Canvas
            displayedHistory={displayedHistory}
            brushColour={brushColour}
            brushRadius={brushRadius}
            eraseMode={eraseMode}
            onStrokeDone={handleStrokeDone}
          />
        </div>
      </Paper>
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
      <div style={{ margin: "10px" }} />
      <ColourPicker
        color={brushColour}
        onChangeComplete={(colour, _) => handleColorChange(colour.hex)}
      />
      <div style={{ margin: "10px" }} />
      <ButtonGroup>
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

      <div
        style={{
          textAlign: "center",
          marginBottom: "10px",
          //display: strokeHistory.current.length > 0 ? "block" : "none", // this wont work, ref changes != rerender
        }}
      >
        <div style={{ marginTop: "30px", marginBottom: "10px" }}>
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
              ? "(press enter to lock in your guess)"
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
