import React, { useMemo, useState } from "react";
import { useService } from "@xstate/react";
import { mainService } from "./machine";
import { debug, deserialiseStrokes, useLocalStorage } from "./util";
import Game from "./Game";
import Match from "./Match";
import {
  Button,
  CircularProgress,
  CssBaseline,
  Typography,
  useMediaQuery,
} from "@material-ui/core";

import { ThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import SpeedDial from "@material-ui/lab/SpeedDial";
import SpeedDialAction from "@material-ui/lab/SpeedDialAction";
import SettingsIcon from "@material-ui/icons/Settings";
import GitHubIcon from "@material-ui/icons/GitHub";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";

import Canvas from "./Canvas";

const Loading = React.memo((props: any) => (
  <div
    style={{
      margin: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}
  >
    <Typography variant="h6">{props.msg}</Typography>
    <CircularProgress style={{ marginTop: "10px" }} />
  </div>
));

const Error = React.memo((props: any) => (
  <div
    style={{
      margin: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}
  >
    <div
      style={{
        display: "flex",
        flexFlow: "wrap-reverse",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography variant="h4" style={{ padding: "10px" }}>
        Error
      </Typography>
      <ErrorOutlineIcon />
    </div>
    <br />
    <Typography variant="subtitle1">{props.msg}</Typography>
  </div>
));

const rawDefaultPic1 =
  '[["#000",5,400,"AKUArQClAKwApACsAKQArgClAK4="],["#000",5,400,"AKEA5gChAOY="],["#000",5,400,"ANUAmwDVAJsA1gCbANcAmwDYAJsA2ACcANkAnADaAJwA2gCeANsAngDcAJ4A3QCeAN0AnwDdAJ8A3gCgAN8AoADgAKIA4QCiAOEAogDhAKIA4gCjAOMApADkAKQA5QCkAOUApgDlAKYA5QCmAOYApgDmAKcA5wCnAOgAqADpAKgA6QCqAOkAqgDpAKoA6gCqAOoAqwDrAKsA6wCsAOwArADtAK4A7QCuAO0ArgDtAK8A7gCvAO4AsADvALAA8ACyAPAAswDxALMA8QC0APEAtADxALQA8QC1APIAtgDyALcA8gC4APMAuADzALkA9AC6APQAvAD1ALwA9QC9APUAvgD1AL8A9QDAAPUAwAD1AMAA9QDBAPUAwgD2AMMA9gDEAPYAxAD2AMUA9gDGAPYAxwD2AMgA9gDIAPcAygD3AMsA9wDMAPcAzAD3AM0A9wDOAPcAzwD3ANAA9wDQAPcA0QD2ANMA9gDUAPYA1AD2ANUA9gDWAPUA1gD1ANcA9QDYAPUA2AD1ANkA9QDaAPUA2wDzANwA8wDcAPMA3QDzAN0A8wDeAPMA3wDyAOAA8QDhAPEA4gDxAOMA8QDkAO8A5ADvAOQA7wDlAO8A5QDvAOYA7wDnAO4A5wDuAOgA7QDoAO0A6QDtAOkA7QDqAO0A6gDrAOoA6wDsAOsA7ADrAO0A6gDuAOoA7gDpAO4A6QDwAOkA8ADnAPEA5wDyAOcA8gDnAPIA5gD0AOYA9ADlAPQA5QD1AOUA9QDlAPYA4wD4AOMA+ADiAPgA4gD5AOEA+QDhAPoA4QD6AOEA+gDhAPwA4AD8AN8A/ADfAPwA3gD8AN0A/ADdAP0A3AD9ANsA/QDbAP4A2gD+ANkA/gDZAP4A2QD+ANgA/gDXAQAA1gEAANUBAADVAQEA1AEBANQBAgDTAQIA0wECANMBAgDTAQQA1AEE"]]';
const rawDefaultPic2 =
  '[["#abc",5,400,"AKUArQClAKwApACsAKQArgClAK4="],["#abc",5,400,"AKEA5gChAOY="],["#000",5,400,"ANUAmwDVAJsA1gCbANcAmwDYAJsA2ACcANkAnADaAJwA2gCeANsAngDcAJ4A3QCeAN0AnwDdAJ8A3gCgAN8AoADgAKIA4QCiAOEAogDhAKIA4gCjAOMApADkAKQA5QCkAOUApgDlAKYA5QCmAOYApgDmAKcA5wCnAOgAqADpAKgA6QCqAOkAqgDpAKoA6gCqAOoAqwDrAKsA6wCsAOwArADtAK4A7QCuAO0ArgDtAK8A7gCvAO4AsADvALAA8ACyAPAAswDxALMA8QC0APEAtADxALQA8QC1APIAtgDyALcA8gC4APMAuADzALkA9AC6APQAvAD1ALwA9QC9APUAvgD1AL8A9QDAAPUAwAD1AMAA9QDBAPUAwgD2AMMA9gDEAPYAxAD2AMUA9gDGAPYAxwD2AMgA9gDIAPcAygD3AMsA9wDMAPcAzAD3AM0A9wDOAPcAzwD3ANAA9wDQAPcA0QD2ANMA9gDUAPYA1AD2ANUA9gDWAPUA1gD1ANcA9QDYAPUA2AD1ANkA9QDaAPUA2wDzANwA8wDcAPMA3QDzAN0A8wDeAPMA3wDyAOAA8QDhAPEA4gDxAOMA8QDkAO8A5ADvAOQA7wDlAO8A5QDvAOYA7wDnAO4A5wDuAOgA7QDoAO0A6QDtAOkA7QDqAO0A6gDrAOoA6wDsAOsA7ADrAO0A6gDuAOoA7gDpAO4A6QDwAOkA8ADnAPEA5wDyAOcA8gDnAPIA5gD0AOYA9ADlAPQA5QD1AOUA9QDlAPYA4wD4AOMA+ADiAPgA4gD5AOEA+QDhAPoA4QD6AOEA+gDhAPwA4AD8AN8A/ADfAPwA3gD8AN0A/ADdAP0A3AD9ANsA/QDbAP4A2gD+ANkA/gDZAP4A2QD+ANgA/gDXAQAA1gEAANUBAADVAQEA1AEBANQBAgDTAQIA0wECANMBAgDTAQQA1AEE"]]';
const rawHello =
  '[["#000",5,500,"AFoAsABZALIAWAC0AFgAtwBXALkAVwC8AFYAvwBVAMIAVQDFAFQAxwBTAMkAUwDMAFMAzwBSANEAUQDTAFEA1gBRANoAUADcAE8A3wBPAOIATgDkAE0A5wBMAOoASwDtAEsA8ABKAPIASQD0AEgA9gBHAPgARwD7AEYA/wBFAQEARAEDAEQBBgBDAQgAQwELAEEBDQBBARAAQAESAD8BFQA+ARgAPQEbAD0BHwA8ASEAOwEjADsBJgA6ASkAOQEsADgBMAA3ATMANgE2ADYBOQA1ATsANQE+ADUBQQA0AUMANAFGADMBSAAzAUsAMwFOADIBTAAzAUoAMwFHADQBRQA2AUMANwFBADgBPwA5ATwAOgE6ADsBOAA8ATYAPQE0AD4BMgA+AS8AQAEtAEEBKwBCASkARAEoAEUBJgBGASQARgEhAEcBHwBIAR0ASQEbAEoBGQBMARcATQEVAE8BFABRARIAUQEPAFMBDgBUAQwAVgELAFgBCQBaAQcAWwEFAF0BBABfAQMAYgEDAGIBBgBiAQkAYgEMAGIBDwBiARMAYwEVAGMBGABjARsAYwEeAGMBIQBjASQAYwEnAGMBKgBjAS0AYgEvAGIBMgBiATUAYQE3AGEBOgBgATwAYAE/AGABQgBgAUUAXwFHAF8BSgBhAUsAYwFMAGUBTg=="],["#000",5,500,"ALUBRACyAUQAsAFFAK4BRgCrAUYAqAFGAKYBRwCjAUcAoAFHAJ0BRwCaAUcAlwFHAJQBRwCSAUYAkAFFAI8BQwCOAUEAjgE+AI0BPACNATkAjQE2AI0BMwCMATEAjAEuAIwBKwCMASgAjAElAIwBIgCMAR8AjAEcAIwBGQCMARYAjQEUAI0BEQCNAQ4AjQELAI0BCACNAQUAjgEDAJABAQCRAP8AkgD9AJQA/ACVAPoAlwD5AJkA+ACbAPcAnQD2AJ8A9QChAPQApAD0AKcA9ACqAPQAqwD2AK0A9wCvAPgAsQD5ALMA+gC1APsAtQD+ALYBAAC2AQMAtgEGALYBCQC1AQsAtQEOALUBEQC0ARMAsgEVALABFgCvARgArQEZAKsBGgCpARsApwEcAKQBHACiAR0="],["#000",5,500,"AN8A5wDeAOkA3gDsAN4A7wDeAPIA3gD1AN4A+ADeAPsA3QD+AN0BAQDdAQQA3QEHAN0BCgDdAQ0A3QEQAN0BEwDdARYA3QEZAN0BHADdAR8A3gEhAN4BJADfASYA3wEpAN8BLADgAS4A4AEx"],["#000",5,500,"AREA4wEPAOQBDwDnAQ4A6QEOAOwBDgDvAQ0A8QENAPQBDAD2AQsA+AELAPsBCwD+AQoBAAEJAQIBCQEFAQgBBwEIAQoBBwEMAQcBDwEHARIBBwEVAQYBFwEGARoBBgEdAQYBIAEGASMBBgEm"],["#000",5,500,"AT0A8QFAAPEBQwDxAUYA8QFJAPEBSwDyAU0A8wFQAPMBUgD0AVUA9AFXAPUBWQD2AVwA9gFdAPgBXwD5AWAA+wFhAP0BYgD/AWMBAQFjAQQBYwEHAWMBCgFiAQ0BYgEQAWEBEgFhARUBYAEXAV8BGQFfARwBXgEeAV0BIAFcASIBWwEkAVkBJQFYAScBVgEoAVQBKQFRASkBTgEpAUsBKQFIASkBRQEpAUIBKQE/ASkBPAEoAToBJwE5ASUBNwEjATcBIAE3AR0BNgEbATYBGAE1ARYBNQETATUBEAE1AQ0BNQEKATYBCAE2AQUBNgECATcBAAE3AP0BOAD7ATkA+QE5APYBPAD2AT4A9QFBAPUBQwD2"],["#000",5,500,"Aa8AmQGvAJwBrwCfAa8AogGvAKUBrwCoAa8AqwGvAK4BrwCxAa8AtAGvALcBrgC5Aa4AvAGuAL8BrgDCAa4AxQGuAMgBrgDLAa4AzwGuANIBrgDVAa4A2AGuANsBrgDeAa8A4AGvAOMBrwDmAbAA6AGwAOsBsADuAbAA8QGxAPMBsQD2"],["#000",5,500,"AakBIQ=="]]';
const rawFace =
  '[["#000",7,300,"AG8AbQ=="],["#000",7,300,"AG8Awg=="],["#000",7,300,"ALAAQQCzAEQAtQBGALgASAC7AEwAvQBQAL8AUgDBAFUAwwBZAMQAXgDGAGMAxwBnAMoAawDLAHEAzAB2AM8AfQDQAIUA0QCPANIAmgDSAKQA0gCuAM8AuwDMAMkAyADVAMQA4QC+AOwAuQD1ALQA/QCzAQA="],["#9f0500",17,300,"AJwAmQ=="]]';
const rawPictgame =
  '[["#d33115",3,300,"AD0AQAA9AFEAPABZADwAXQA6AGUAOQBqADgAbA=="],["#d33115",3,300,"AD8AQgBGADsASwA6AFEAOwBVAD0AVwBEAFUASgBPAFIASQBWAEUAVwBBAFYAPwBV"],["#e27300",3,300,"AIkAQQCAAEEAegBCAHMARABuAEQAawBE"],["#e27300",3,300,"AHgAQwB4AFAAeABTAHcAWAB2AF4AdgBjAHcAZQ=="],["#e27300",3,300,"AIcAaQB6AGwAdQBsAG0AbABpAGwAZwBsAGUAbA=="],["#fcc400",3,300,"ALQARgCqAEcApABKAKAATgCdAFQAmgBbAJoAYgCbAGgAngBsAKQAbgCrAG4AsQBu"],["#68bc00",2,300,"AOQASADUAEoAzABLAMcASwDFAEwAwwBM"],["#68bc00",2,300,"ANQAUADTAF0A0wBgANIAZQDSAGsA0gBt"],["#009ce0",2,300,"AEQAnwBHAJgAQgCaAD4AnAA5AKAAMgCnACsAsQAmAL4AJADLACMA1QAlANoAKADbAC4A2QA0ANQAOwDMAD4AyABAAMcAQgDJAEMAzwBEANUARQDaAEUA3A=="],["#009ce0",2,300,"AE4AxABBAMcAOwDGADcAxQA1AMU="],["#7b64ff",2,300,"AGkAnQBlAKcAZACoAGIAsQBeAL4AXADKAFoA0wBYANgAWADaAFgA2A=="],["#7b64ff",2,300,"AGoAnQBxAKwAdAC4AHgAxAB6AM4AfADVAHwA2QB7ANwAeQDc"],["#7b64ff",2,300,"AHMAwgBpAMMAZwDDAGQAxABgAMMAXgDDAFwAww=="],["#fa28ff",2,300,"AJMApQCSAK0AkQCvAJAAtwCPAMMAjgDLAI0A1ACMANkAiwDbAIsA2QCMANMAjQDJAI4AvgCPALYAkQCwAJMArACVAKcAlwCkAJgAogCaAKYAmwCuAJwAtwCeAMEAoADJAKEAzgCiAM8AogDKAKMAwgCkALcApgCuAKkAqACrAKQArgCiALAAogCzAKUAtgCsALcAuAC5AMYAuQDRALoA1gC6ANg="],["#666666",2,300,"AOEAogDZAKEA1wChANMAogDRAKIA0ACjAM4AowDNAKQAywClAMsApwDLAKkAywCtAMoAsQDKALYAygC7AMoAvwDKAMIAyQDFAMkAxwDJAMoAyQDMAMkAzgDJANAAyQDSAMkA1ADJANYAywDXAM0A1gDRANYA1QDVANgA1QDaANUA3ADV"],["#666666",2,300,"ANwAugDSALkAzwC5AM0AuQ=="],["#000000",2,300,"AHcBAw=="],["#000000",2,300,"AHYBDg=="],["#000000",2,300,"AIAA/QCGAQMAhwEFAIcBCACGAQwAgwESAH8BFQ=="]]';
const rawPictgame1 =
  '[["#d33115",4,300,"ADoAOwA6AEQAOABRADcAYQA3AGM="],["#d33115",4,300,"AD4AOgBHADMATwAzAFoAOgBaAEIAVQBKAE0ATgBDAE0APwBK"],["#e27300",4,300,"AIsAOQB9ADoAdgA7AHAAPABrAD0="],["#e27300",4,300,"AHkAPQB3AEwAdgBUAHYAWgB2AF4AdgBg"],["#e27300",4,300,"AIMAZgB0AGYAbgBmAGoAZQBoAGU="],["#fcc400",4,300,"AK8APgCjAEMAmwBPAJoAVgCbAF4AoABjAKcAZgCuAGcAsgBo"],["#68bc00",4,300,"AOsAPADXAD0A0QA9AM0APQDKAD8="],["#68bc00",4,300,"ANgAPwDYAEkA1wBTANcAXgDXAGk="],["#16a5a5",4,300,"ADkApwAwAKoAKwCuACcAtAAkALoAIwDAACQAxQAnAMgALQDJADIAyAA3AMQAOQDBADsAvgA9AL0APwDBAD8AygA+AM4="],["#16a5a5",4,300,"AEoAvQA+AL4ANgC9ADQAvA=="],["#009ce0",4,300,"AG4ApABqAKsAZgC1AGIAvwBfAMkAXQDPAFwA0wBbANUAXADT"],["#009ce0",4,300,"AHAApQB2AKsAegC0AH0AvQCAAMUAgQDMAIEA0ACAANI="],["#009ce0",4,300,"AHsAvQBwAMAAbADAAGgAwABmAMA="],["#7b64ff",4,300,"AKAAqQCeALkAnQDCAJwAzwCcANEAnADMAJ4AxQCgALwAogC0AKQArAClAKgApwCjAKkAoQCrAKEArgCjAK8AqACxAK4AsgC2ALMAvQCzAMEAswDDALMAwQC1AL0AtwC2ALkArwC8AKoAvwCmAMEApQDDAKUAxACpAMYAsQDIALsAyQDEAMoAygDLAM8="],["#fa28ff",4,300,"APkAqQDvAKoA7ACqAOcAqwDlAKwA5ACuAOMAsQDjALUA4wC7AOMAwQDiAMYA4QDKAOAAzgDgANAA4QDSAOMA0wDnANQA7wDTAPMA0gD1ANE="],["#fa28ff",4,300,"APcAwADuAMAA5wDAAOQAvw=="],["#000000",2,300,"AIABAA=="],["#000000",2,300,"AH8BDA=="],["#000000",2,300,"AIwA+QCUAP8AlQEGAJUBDQCNARYAigEX"]]';

const rawPictgame2 =
  '[["#d33115",4,300,"ADoAOwA6AEQAOABRADcAYQA3AGM="],["#d33115",4,300,"AD4AOgBHADMATwAzAFoAOgBaAEIAVQBKAE0ATgBDAE0APwBK"],["#e27300",4,300,"AIsAOQB9ADoAdgA7AHAAPABrAD0="],["#e27300",4,300,"AHkAPQB3AEwAdgBUAHYAWgB2AF4AdgBg"],["#e27300",4,300,"AIMAZgB0AGYAbgBmAGoAZQBoAGU="],["#fcc400",4,300,"AK8APgCjAEMAmwBPAJoAVgCbAF4AoABjAKcAZgCuAGcAsgBo"],["#68bc00",4,300,"AOsAPADXAD0A0QA9AM0APQDKAD8="],["#68bc00",4,300,"ANgAPwDYAEkA1wBTANcAXgDXAGk="],["#16a5a5",3,300,"AEsArQA+ALIAOQC5ADYAwAA0AMcAMwDOADMA0wA0ANcAOADYAD0A1QBDANAASADLAEoAxwBMAMoATADPAEwA0wBMANY="],["#16a5a5",3,300,"AFkAwQBMAMQARwDEAEMAxAA/AMMAPQDC"],["#009ce0",3,300,"AGMA1wBoAMsAbQDEAHEAvABzALYAdQCxAHYArwB3AK0AeACr"],["#009ce0",3,300,"AHkArAB9ALQAgAC8AIMAxACFAMwAhwDWAIgA2ACHANU="],["#009ce0",3,300,"AIEAxgB1AMUAcADGAG0AxgBpAMc="],["#7b64ff",3,300,"AJ8ArQCdAMAAnADMAJwA0ACbANIAnADQAJ0AywCeAMQAnwC8AKAAtQCiAK8AowCrAKYAqwCoALAAqgC3AKsAvwCrAMQAqwDHAKsAxACsAL4ArgC3ALEAsAC0AKsAtgCqALgArAC5ALIAuwC8ALwAxQC9AMwAvQDQ"],["#fa28ff",3,300,"AOEAqgDYAKoA1gCqANQArADTAK4A0wCxANIAtwDSAL0A0QDCANEAxwDRAMsA0QDNANAA0ADPANIA1ADSANkA0ADdANAA4ADPAOIAzw=="],["#fa28ff",3,300,"AOQAvwDaAL8A1gC+ANMAvg=="],["#000000",2,300,"AIkBAA=="],["#000000",2,300,"AIcBDQ=="],["#000000",2,300,"AJIA+QCYAQAAmQEDAJkBBgCZAQkAlgEQAJQBEgCSARQAkQEV"]]';

const rawImages = [
  rawPictgame2,
  rawPictgame1,
  rawPictgame,
  rawFace,
  rawHello,
  rawDefaultPic2,
  rawDefaultPic1,
];

const Start = (props: any) => {
  const { name, onStart, deviceIsSmall } = props;
  const [imgIdx, setImgIdx] = useState(0);
  const image = useMemo(
    () => deserialiseStrokes(JSON.parse(rawImages[imgIdx])),
    [imgIdx]
  );

  return (
    <div
      style={{
        margin: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        //border: "red dashed",
      }}
    >
      <div
        style={{
          position: "relative",
          marginBottom: "30px",
          overflow: "hidden",
          opacity: 1,
          transform: "translateY(-0%)",
          transition: "all 4s ease 2s",
        }}
        onClick={() => setImgIdx((imgIdx + 1) % rawImages.length)}
      >
        <Canvas
          displayedHistory={image}
          size={deviceIsSmall ? 300 : 400}
          animated
          locked
        />
      </div>
      <Typography variant="h5">Welcome, {name}!</Typography>
      <div style={{ marginBottom: "20px" }} />
      <Button onClick={onStart}>Start game</Button>
    </div>
  );
};

const OptionsFAB = (props: any) => {
  const [fabOpen, setFabOpen] = useState(false);
  const { darkMode, setDarkMode } = props;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        marginLeft: "10px",
        marginTop: "10px",
        zIndex: 999,
        transform: "translateZ(0px)",
      }}
    >
      <SpeedDial
        ariaLabel="Options"
        hidden={false}
        icon={<SettingsIcon />}
        open={fabOpen}
        direction={"right"}
        onClick={() => setFabOpen(!fabOpen)}
      >
        <SpeedDialAction
          key={"github"}
          icon={<GitHubIcon />}
          tooltipTitle={"Github"}
          onClick={() => window.open("https://github.com/siidheesh/pictgame")}
        />
        <SpeedDialAction
          key={"darkMode"}
          icon={darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
          tooltipTitle={darkMode ? "Light" : "Dark"}
          onClick={() => setDarkMode(!darkMode)}
        />
      </SpeedDial>
    </div>
  );
};

const Main = () => {
  const [state, send] = useService(mainService);
  const m = state.matches;
  const inInit = m("init");
  const inIdle = m("idle");
  const inError = m("error");
  const isMatchmaking = m("match");
  const inGame = m("game");
  const deviceIsSmall = useMediaQuery("(max-width:600px)", { noSsr: true });

  debug("main render", state.toStrings().join(" "));

  if (inInit) {
    let msg = "Loading...";
    if (state.context.name) {
      // we were previously connected
      msg = "Lost connection to server, re-establishing...";
    } else if (m("init.prepareSocket.disconnected")) {
      msg = "Establishing connection";
    } else if (m("init.prepareSocket.waitForName")) {
      msg = "Starting session";
    }
    return <Loading msg={msg} />;
  }

  if (inError) {
    return <Error msg={state.context.errorMsg} />;
  }

  if (inIdle) {
    const handleStart = () => send("MATCH");
    return (
      <Start
        name={state.context.name}
        onStart={handleStart}
        deviceIsSmall={deviceIsSmall}
      />
    );
  }

  if (isMatchmaking) return <Match {...{ state, send }} />;

  if (inGame) return <Game {...{ state, send }} />;

  return <div>main: unhandled {state.toStrings().join(" ")}</div>;
};

const MainWrapper = (props: any) => {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [darkMode, setDarkMode] = useLocalStorage<boolean>(
    "darkMode",
    prefersDarkMode
  );
  const theme = createMuiTheme({
    palette: {
      type: darkMode ? "dark" : "light",
      primary: {
        main: "#1a9ace",
      },
    },
    overrides: {
      MuiFab: {
        primary: {
          backgroundColor: "grey",
        },
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <OptionsFAB {...{ darkMode, setDarkMode }} />
      {props.children}
    </ThemeProvider>
  );
};

const App = () => (
  <MainWrapper>
    <Main />
  </MainWrapper>
);

export default App;
