import React, { useState, useRef } from "react";
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

import { Icon } from "@iconify/react";
import eraserIcon from "@iconify-icons/mdi/eraser";

import Canvas from "./Canvas";
import { Stroke } from "./Canvas";
import { CompactPicker } from "react-color";

import { serialiseStrokes, deserialiseStrokes } from "./util";

interface DrawProps {
  [key: string]: any;
}

const defaultPic = deserialiseStrokes(JSON.parse("[]"));

const Draw = (props: DrawProps) => {
  const defaultProps: DrawProps = {
    brushRadius: 5,
    brushRadiusMin: 1,
    brushRadiusMax: 20,
    brushRadiusStep: 1,
    canvasSize: 300,
    brushColour: "black",
  };
  const getProp = (propName: string) => {
    return props[propName] ?? defaultProps[propName];
  };

  const [eraseMode, setEraseMode] = useState(false);
  const [brushColour, setBrushColour] = useState(getProp("brushColour"));
  const [brushRadius, setbrushRadius] = useState(getProp("brushRadius"));

  //const [strokeHistory, setStrokeHistory] = useState([] as Stroke[]);
  const [forcedHistory, setForcedHistory] = useState(defaultPic);
  const strokeHistory = useRef(defaultPic);

  const [description, setDescription] = useState("");
  const [inputValid, setInputValid] = useState({ description: false });

  const handleColorChange = (colour: string) => setBrushColour(colour);
  const ColourPicker = CompactPicker;

  const handleDescChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newDesc = e.target.value;
    setDescription(newDesc);
    setInputValid({ description: !!newDesc });
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
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Canvas
              strokeHistory={strokeHistory}
              onStrokeHistoryChange={(newStrokeHist: Stroke[]) => {
                strokeHistory.current = newStrokeHist;
              }}
              forcedHistory={forcedHistory}
              brushColour={brushColour}
              brushRadius={brushRadius}
              eraseMode={eraseMode}
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
          //orientation="vertical"
        />
        <div
          style={{
            display: "flex",
            width: "auto",
            alignItems: "center",
            margin: "20px",
          }}
        >
          <ColourPicker
            color={brushColour}
            onChangeComplete={(colour, _) => handleColorChange(colour.hex)}
          />
          <ButtonGroup>
            <Tooltip title="Eraser" aria-label="eraser">
              <ToggleButton
                value="check"
                selected={eraseMode}
                onChange={() => setEraseMode(!eraseMode)}
                style={{ marginLeft: "20px" }}
              >
                <Icon icon={eraserIcon} />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Clear" aria-label="clear">
              <Button onClick={() => setForcedHistory([])}>
                <DeleteIcon />
              </Button>
            </Tooltip>
          </ButtonGroup>
        </div>
        <div
          style={{
            textAlign: "center",
            marginBottom: "10px",
          }}
        >
          <div style={{ marginTop: "20px", marginBottom: "10px" }}>
            <Typography
              variant="h6"
              onClick={() =>
                console.log(
                  JSON.stringify(serialiseStrokes(strokeHistory.current))
                )
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
            helperText={!inputValid.description && "Must be filled"}
            error={!inputValid.description}
          />
        </div>
        <Button
          color="primary"
          onClick={() => {
            inputValid.description &&
              props.onSubmit({
                pic: strokeHistory.current,
                label: description,
              });
          }}
        >
          Submit
        </Button>
      </div>
    </div>
  );
};

export default Draw;
