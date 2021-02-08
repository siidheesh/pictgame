import React, { useState, useRef, ChangeEvent } from "react";

import "./App.css";

import {
  Button,
  ButtonGroup,
  Paper,
  Slider,
  Typography,
} from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import DeleteForeverRoundedIcon from "@material-ui/icons/DeleteForeverRounded";
import SaveAltIcon from "@material-ui/icons/SaveAlt";

import { Icon } from "@iconify/react";
import eraserIcon from "@iconify-icons/mdi/eraser";

import Canvas from "./Canvas";
import { Stroke } from "./Canvas";
import { CompactPicker } from "react-color";

import { serialiseStrokes, deserialiseStrokes } from "./util";
import { deserialize } from "v8";

//import { visitEachChild } from "typescript";

interface Props {
  [key: string]: any;
}

/*const defaultPic: Stroke[] = JSON.parse(
  '[{"colour":"black","brushRadius":15,"points":[[90,151]]},{"colour":"black","brushRadius":15,"points":[[90,150]]},{"colour":"black","brushRadius":15,"points":[[82,221]]},{"colour":"black","brushRadius":15,"points":[[82,220]]},{"colour":"black","brushRadius":15,"points":[[170,129],[171,137],[171,141],[172,145],[173,153],[173,160],[174,169],[175,178],[175,186],[175,195],[175,203],[177,210],[177,220],[177,228],[177,234],[177,240],[177,244],[177,247],[178,250],[178,253],[179,254],[179,255],[179,256],[179,257],[179,258],[179,258],[179,259],[179,260],[179,262],[178,263],[178,265],[177,266],[177,266],[177,267],[177,268],[177,270],[177,271],[177,273],[177,274],[177,274],[177,275],[177,276],[177,278],[177,279],[176,282],[176,284],[176,286],[176,286],[176,287],[176,288],[176,290],[176,291],[176,294],[175,296],[175,300],[175,303],[175,306],[175,308],[175,310],[175,310],[175,311],[175,312],[175,312],[175,314],[175,314],[175,316],[175,318],[175,318],[174,318]]},{"colour":"black","brushRadius":15,"points":[[167,120],[177,122],[179,122],[181,123],[182,123],[183,123],[185,124],[187,124],[188,124],[190,124],[191,124],[192,124],[194,124],[195,124],[197,126],[199,126],[200,126],[202,127],[203,128],[204,128],[205,128],[207,130],[207,130],[208,131],[209,131],[210,132],[211,132],[212,132],[214,134],[215,134],[217,135],[219,136],[220,136],[222,137],[223,137],[224,138],[225,138],[226,138],[227,139],[228,139],[230,140],[231,140],[233,140],[234,140],[235,141],[236,142],[237,143],[238,144],[239,144],[240,145],[241,146],[243,148],[243,149],[245,151],[245,152],[247,153],[247,156],[249,157],[249,158],[249,160],[251,160],[252,163],[253,164],[255,165],[255,167],[255,168],[256,170],[256,171],[256,172],[256,174],[256,176],[256,177],[256,179],[256,180],[256,181],[255,183],[253,184],[253,186],[250,188],[248,189],[245,191],[243,193],[241,194],[237,196],[235,198],[233,200],[231,200],[229,201],[227,202],[225,204],[223,204],[220,205],[217,205],[215,206],[212,208],[210,208],[207,209],[204,210],[202,212],[199,213],[197,214],[195,216],[195,216],[194,216],[193,217],[192,217],[191,217],[191,217],[190,217]]}]'
);*/

const defaultPic = deserialiseStrokes(
  JSON.parse(
    "[]"
    //'[["#000000",5,"AI8AaQCEAGoAgwBqAIEAagB/AGoAfwBqAH4AagB9AGoAfABqAHsAagB6AGoAdwBoAHMAZwBxAGYAbwBlAG0AZABrAGMAawBiAGoAYgBpAGIAaQBjAGkAZgBpAGsAaQB0AGkAegBpAIkAaQCUAGkAoABoAKoAaACzAGgAtwBoALsAaAC8AGgAvQBpAL0AaQC9AGsAvABtALwAcQC6AHUAuQB5ALkAfgC5AIQAuQCKALkAjwC4AJAAuACRALg="],["#000000",5,"AG8AlAB5AJYAegCWAHwAlgB+AJYAgACWAIIAlgCEAJYAhQCWAIcAlgCHAJYAiACWAIkAlgCKAJYAiwCWAIwAlg=="],["#000000",5,"AKwAuACtALAArQCuAK4ArACvAKsArwCqAK8AqACwAKgAsQCoALEApwCyAKcAsgCmALMApgCzAKUAtAClALUApAC3AKMAuQCiALwAoQC9AKAAwACgAMEAnwDDAJ4AwwCeAMMAnQ=="],["#000000",5,"AOYAoADfAKYA3wCmAN4ApwDdAKcA3QCoAN0AqgDcAKoA2wCrANsArADaAKwA2gCtAN0ArgDeALAA3wCwAOEAsQDiALEA5ACyAOQAswDlALMA5QCzAOYAswDnALMA6ACzAOgAsgDpALIA6QCyAOkAsADpALAA6QCvAOoArQDqAKwA6wCqAOwAqADsAKYA7QCkAO0ApADtAKMA7QCiAO0AoQDuAKEA7gCiAPAAogDxAKQA8QCmAPMAqAD0AKgA9ACqAPUArAD1AK0A9gCvAPgAsAD5ALIA+QCzAPoAtAD7ALQA/AC1AP0AtgD9ALYA/gC2AP8AtwEAALcBAQC3AQQAtwEGALcBCAC3AQoAtw=="],["#000000",5,"ARoApAESAKIBEACiAQ8AoQENAKEBCwChAQoAoAEJAKABCQCgAQcAoAEHAKIBBwCiAQcApAEIAKcBCQCqAQsArAENALABDwCxARIAtAEVALUBFwC3ARoAuAEdALkBHgC6AR8AuwEhALwBIQC8ASIAvAEiALwBIAC8AR8AvAEdAL0BGwC9ARoAvgEYAL4BFwC+ARcAvgEWAL4BFQC+"],["#000000",5,"AUUAvAE8ALoBOgC6ATcAuAE1ALgBMwC3ATAAtgEvALQBLACyASsAsAEqALABKgCuASkArQEpAKwBKQCsASkAqwEpAKoBKgCqASoAqQErAKgBKwCoAS0ApwEvAKYBMACkATMApAE0AKIBNwChATgAoAE6AJ8BOwCfATsAngE8AJ4BPQCeAT4AnwE/AJ8BPwCgAUAAoAFAAKIBQACiAT8AowE/AKMBPwCkAT4ApAE+AKQBPACkATsApgE7AKYBOgCmATkApgE4AKYBNwCmATcApgE1AKYBMwCmATIApgEvAKcBLQCnASwAqAEsAKoBLACr"],["#000000",5,"AJUA/gCVAPYAlgD2AJcA9ACbAPAAngDsAKAA6gChAOkAoQDpAKMA6QCjAOgApQDoAKUA5wCnAOcApwDnAKgA6ACpAOkAqwDrAKsA7QCtAO8ArwDxAK8A8wCvAPQAsAD2ALAA9wCxAPYAsQD0ALMA9ACzAPEAtQDwALUA7wC3AO4AuADsALkA7AC5AOwAuQDsALkA6wC7AOoAvADpAL0A6AC/AOgAwQDmAMMA5QDFAOUAyADkAMkA5ADKAOQAywDmAMwA5gDNAOYAzQDoAM0A6ADOAOkAzgDrAM8A7ADPAO0A0ADtANAA7gDQAO8A0ADwANAA8QDQAPIA0QDzANEA8wDSAPQA0gD1ANMA9gDUAPcA1QD4ANUA+QDVAPoA1QD6"],["#000000",5,"AOwA8gDxAOsA8QDrAO8A6gDvAOoA7gDqAO0A6QDtAOkA6wDpAOoA6ADqAOgA6QDoAOkA5wDnAOcA5gDnAOUA5wDjAOgA4QDoAOEA6QDhAOoA3wDsAN8A7QDfAO8A3wDwAN8A8gDfAPMA3wD0AN8A9ADfAPUA4AD2AOEA9wDjAPgA5QD5AOYA+wDoAPwA6QD8AOkA/QDqAP0A6wD9AOwA/QDtAP0A7gD9APAA/QDxAP0A8QD9APEA/ADzAPw="],["#000000",5,"AQoA5wEOAO4BDgDwAQ4A8QEOAPMBDgD0AQ8A9QEPAPYBDwD3AQ8A+AEPAPgBDwD5AQ8A+gEPAPs="],["#000000",5,"AQ0BBQ=="],["#000000",5,"AQ4BBA=="]]'
  )
);

function App(props: Props) {
  const defaultProps: Props = {
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

  const handleColorChange = (colour: string) => setBrushColour(colour);
  const ColourPicker = CompactPicker;

  const handleScroll = (event: React.WheelEvent<HTMLDivElement>) => {
    let radius;
    if (event.deltaY > 0) {
      radius = Math.max(getProp("brushRadiusMin"), brushRadius - 1);
    } else if (event.deltaY < 0) {
      radius = Math.min(getProp("brushRadiusMax"), brushRadius + 1);
    }
    setbrushRadius(radius);
    //console.log("wheel", event.deltaY);
  };

  return (
    <div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          //border: "dashed",
          justifyContent: "space-between",
          alignItems: "center",
        }}
        onWheel={handleScroll}
      >
        <div style={{ marginBottom: "50px" }}>
          <Typography variant="h5" noWrap>
            Time to draw! 🎨
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
            marginBottom: "20px",
          }}
        >
          <ColourPicker
            color={brushColour}
            onChangeComplete={(colour, event) => handleColorChange(colour.hex)}
          />
          <ButtonGroup>
            <ToggleButton
              value="check"
              selected={eraseMode}
              onChange={() => setEraseMode(!eraseMode)}
              style={{ marginLeft: "20px" }}
            >
              <Icon icon={eraserIcon} />
            </ToggleButton>
            <Button onClick={() => setForcedHistory([])}>
              <DeleteForeverRoundedIcon />
            </Button>
            <Button
              onClick={() =>
                console.log(
                  JSON.stringify(serialiseStrokes(strokeHistory.current))
                )
              }
            >
              <SaveAltIcon />
            </Button>
          </ButtonGroup>
        </div>
        <Button
          color="primary"
          onClick={() => {
            props.onSubmit(strokeHistory.current);
          }}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}

export default App;
