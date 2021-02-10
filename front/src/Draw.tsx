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
  const [forcedHistory, setForcedHistory] = useState(defaultPic);
  const strokeHistory = useRef(defaultPic);

  const [description, setDescription] = useState("");
  const [inputValid, setInputValid] = useState({ description: false });

  const undoLevel = useRef(0);
  const [forceUpdate, setForceUpdate] = useState(false);

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
    if (inputValid.description /*&& strokeHistory.current.length > 0*/)
      getProp("onSubmit")({
        pic: strokeHistory.current,
        label: description,
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e?.key === "Enter" || e?.code === "Enter" || e?.keyCode === 13) {
      handleSubmit();
    }
  };

  const sliceHistory = () =>
    strokeHistory.current.slice(
      0,
      strokeHistory.current.length - undoLevel.current
    );

  const handleUndo = () => {
    undoLevel.current = Math.min(
      strokeHistory.current.length,
      undoLevel.current + 1
    );
    debug("handleUndo", undoLevel.current);
    setForcedHistory(sliceHistory());
  };

  const handleRedo = () => {
    undoLevel.current = Math.max(0, undoLevel.current - 1);
    debug("handleRedo", undoLevel.current);
    setForcedHistory(sliceHistory());
  };

  const handleErase = () => {
    if (undoLevel.current >= strokeHistory.current.length) {
      undoLevel.current = 0; // the canvas was already cleared by undo-ing
      strokeHistory.current = []; // manually commit
    } else {
      strokeHistory.current = sliceHistory(); // clear future strokes
      undoLevel.current = -1; // a hack to restore previous strokeHistory on undo, if not yet committed
    }
    debug("handleErase", undoLevel.current);
    setForcedHistory([]);
  };

  const handleStrokeDone = () => {
    undoLevel.current = 0;
    debug("handlePaintDone", undoLevel.current);
    setForceUpdate(!forceUpdate); // a hack to force rerender to show updated undoLevel
  };

  return (
    <div
      style={{
        display: "grid",
        height: "100%",
        padding: "50px 10px 50px 10px",
        //border: "green dashed",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "400px",
          margin: "auto",
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
              justifyContent: "flex-start",
            }}
          >
            <Canvas
              strokeHistory={strokeHistory}
              forcedHistory={forcedHistory}
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
          <Tooltip title="Toggle eraser" aria-label="erase">
            <ToggleButton
              value="check"
              selected={eraseMode}
              onChange={() => setEraseMode(!eraseMode)}
              size="large"
            >
              <Icon icon={eraserIcon} />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Clear" aria-label="clear">
            <Button onClick={handleErase}>
              <DeleteIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Undo" aria-label="undo">
            <Button
              onClick={handleUndo}
              disabled={undoLevel.current >= strokeHistory.current.length}
            >
              <UndoIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Redo" aria-label="redo">
            <Button onClick={handleRedo} disabled={undoLevel.current <= 0}>
              <RedoIcon />
            </Button>
          </Tooltip>
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
                debug(JSON.stringify(serialiseStrokes(strokeHistory.current)))
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
    </div>
  );
};

export default Draw;
