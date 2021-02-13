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
  '[["#d33115",4,300,"[[59,73],[59,82],[57,95],[56,111],[56,113]]"],["#d33115",4,300,"[[61,71],[70,64],[78,64],[89,71],[89,79],[84,87],[76,91],[66,90],[62,87]]"],["#e27300",4,300,"[[146,66],[132,67],[125,68],[119,69],[114,70]]"],["#e27300",4,300,"[[129,74],[127,89],[126,97],[126,103],[126,107],[126,109]]"],["#e27300",4,300,"[[139,111],[124,111],[118,111],[114,110],[112,110]]"],["#fcc400",4,300,"[[183,66],[171,71],[163,83],[162,90],[163,98],[168,103],[175,106],[182,107],[186,108]]"],["#68bc00",4,300,"[[239,65],[219,66],[213,66],[209,66],[206,68]]"],["#68bc00",4,300,"[[223,70],[223,80],[222,90],[222,101],[222,112]]"],["#16a5a5",3,300,"[[77,168],[64,173],[59,180],[56,187],[54,194],[53,201],[53,206],[54,210],[58,211],[63,208],[69,203],[74,198],[76,194],[78,197],[78,202],[78,206],[78,209]]"],["#16a5a5",3,300,"[[93,188],[80,191],[75,191],[71,191],[67,190],[65,189]]"],["#009ce0",3,300,"[[101,210],[106,198],[111,191],[115,183],[117,177],[119,172],[120,170],[121,168],[122,166]]"],["#009ce0",3,300,"[[123,167],[127,175],[130,183],[133,191],[135,199],[137,209],[138,211],[137,208]]"],["#009ce0",3,300,"[[134,193],[122,192],[117,193],[114,193],[110,194]]"],["#7b64ff",3,300,"[[164,171],[162,190],[161,202],[161,206],[160,208],[161,206],[162,201],[163,194],[164,186],[165,179],[167,173],[168,169],[171,169],[173,174],[175,181],[176,189],[176,194],[176,197],[176,194],[177,188],[179,181],[182,174],[185,169],[187,168],[189,170],[190,176],[192,186],[193,195],[194,202],[194,206]]"],["#fa28ff",3,300,"[[232,165],[223,165],[221,165],[219,167],[218,169],[218,172],[217,178],[217,184],[216,189],[216,194],[216,198],[216,200],[215,203],[214,205],[219,205],[224,203],[228,203],[231,202],[233,202]]"],["#fa28ff",3,300,"[[234,185],[224,185],[220,184],[217,184]]"],["#000000",2,300,"[[145,254]]"],["#000000",2,300,"[[145,265]]"],["#000000",2,300,"[[156,246],[162,253],[163,255],[163,258],[163,261],[160,268],[158,270],[156,272],[155,273]]"]]';

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
        padding: "20px",
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
          size={deviceIsSmall ? 200 : 300}
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
