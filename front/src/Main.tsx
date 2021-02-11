import React, { useState } from "react";
import { useService } from "@xstate/react";
import { mainService } from "./machine";
import { debug } from "./util";
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

import { useLocalStorage } from "./util";

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
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <Typography variant="h4">Error&nbsp;</Typography>
      <ErrorOutlineIcon />
    </div>
    <br />
    <Typography variant="subtitle1">{props.msg}</Typography>
  </div>
));

const Start = React.memo((props: any) => {
  const { name, onStart } = props;

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
      <Typography variant="h5">Welcome, {name}!</Typography>
      <div style={{ marginBottom: "20px" }} />
      <Button onClick={onStart}>Start game</Button>
    </div>
  );
});

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
    return <Start name={state.context.name} onStart={handleStart} />;
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
      /*MuiIconButton: {
        root: {
          // fixes bug where undo/redo tooltips remain visible after btn disabled
          // https://stackoverflow.com/questions/61115913/is-it-possible-to-render-a-tooltip-on-a-disabled-material-ui-button-within-a
          "&.Mui-disabled": {
            pointerEvents: "auto",
          },
        },
      },*/
      MuiFab: {
        primary: {
          backgroundColor: "grey",
        },
      },
      MuiPaper: {
        elevation6: {
          // only Paper components with elevation={6}
          backgroundColor: "white",
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
