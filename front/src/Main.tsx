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
//import Draw from "./Draw";

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

const rawLogo =
  '[["#d33115",4,300,"ADsASQA7AFIAOQBfADgAbwA4AHE="],["#d33115",4,300,"AD0ARwBGAEAATgBAAFkARwBZAE8AVABXAEwAWwBCAFoAPgBX"],["#e27300",4,300,"AJIAQgCEAEMAfQBEAHcARQByAEY="],["#e27300",4,300,"AIEASgB/AFkAfgBhAH4AZwB+AGsAfgBt"],["#e27300",4,300,"AIsAbwB8AG8AdgBvAHIAbgBwAG4="],["#fcc400",4,300,"ALcAQgCrAEcAowBTAKIAWgCjAGIAqABnAK8AagC2AGsAugBs"],["#68bc00",4,300,"AO8AQQDbAEIA1QBCANEAQgDOAEQ="],["#68bc00",4,300,"AN8ARgDfAFAA3gBaAN4AZQDeAHA="],["#16a5a5",3,300,"AE0AqABAAK0AOwC0ADgAuwA2AMIANQDJADUAzgA2ANIAOgDTAD8A0ABFAMsASgDGAEwAwgBOAMUATgDKAE4AzgBOANE="],["#16a5a5",3,300,"AF0AvABQAL8ASwC/AEcAvwBDAL4AQQC9"],["#009ce0",3,300,"AGUA0gBqAMYAbwC/AHMAtwB1ALEAdwCsAHgAqgB5AKgAegCm"],["#009ce0",3,300,"AHsApwB/AK8AggC3AIUAvwCHAMcAiQDRAIoA0wCJANA="],["#009ce0",3,300,"AIYAwQB6AMAAdQDBAHIAwQBuAMI="],["#7b64ff",3,300,"AKQAqwCiAL4AoQDKAKEAzgCgANAAoQDOAKIAyQCjAMIApAC6AKUAswCnAK0AqACpAKsAqQCtAK4ArwC1ALAAvQCwAMIAsADFALAAwgCxALwAswC1ALYArgC5AKkAuwCoAL0AqgC+ALAAwAC6AMEAwwDCAMoAwgDO"],["#fa28ff",3,300,"AOgApQDfAKUA3QClANsApwDaAKkA2gCsANkAsgDZALgA2AC9ANgAwgDYAMYA2ADIANcAywDWAM0A2wDNAOAAywDkAMsA5wDKAOkAyg=="],["#fa28ff",3,300,"AOoAuQDgALkA3AC4ANkAuA=="],["#000000",2,300,"AJEA/g=="],["#000000",2,300,"AJEBCQ=="],["#000000",2,300,"AJwA9gCiAP0AowD/AKMBAgCjAQUAoAEMAJ4BDgCcARAAmwER"]]';

const Start = (props: any) => {
  const { name, onStart, deviceIsSmall } = props;
  const [animDone, setAnimDone] = useState(false);
  const image = useMemo(() => deserialiseStrokes(JSON.parse(rawLogo)), []);

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
      >
        <Canvas
          displayedHistory={image}
          size={deviceIsSmall ? 300 : 400}
          animated={!animDone}
          locked={!animDone}
          onAnimDone={() => setAnimDone(true)}
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
  const { darkMode, onToggle } = props;
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
          onClick={onToggle}
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
  const [darkMode, setDarkMode] = useLocalStorage<boolean | null>(
    "darkMode",
    null
  );

  const theme = createMuiTheme({
    palette: {
      type: darkMode ?? prefersDarkMode ? "dark" : "light",
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
      <OptionsFAB {...{ darkMode }} onToggle={() => setDarkMode(!darkMode)} />
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
