import React, { lazy, Suspense, useState } from "react";
import { useService } from "@xstate/react";
import { mainService } from "./machine";
import { debug, useLocalStorage } from "./util";
import Error from "./Error";
import {
  Button,
  CssBaseline,
  Typography,
  useMediaQuery,
} from "@material-ui/core";

import { ThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import SpeedDial from "@material-ui/lab/SpeedDial";
import SpeedDialAction from "@material-ui/lab/SpeedDialAction";
import MenuIcon from "@material-ui/icons/Menu";
import GitHubIcon from "@material-ui/icons/GitHub";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import BugReportIcon from "@material-ui/icons/BugReport";

import { Stroke } from "./Canvas";
import LogoWrapper from "./LogoWrapper";
import Loading from "./Loading";

const Game = lazy(() => import("./Game"));
const Match = lazy(() => import("./Match"));
const Draw = lazy(() => import("./Draw"));
const UserOffline = lazy(() => import("./UserOffline"));

const Start = React.memo((props: any) => {
  const { name, onStart, onSinglePlayer, online } = props;

  return (
    <>
      <Typography variant="h5">
        {name ? `Welcome, ${name}!` : "Welcome!"}
      </Typography>
      <div style={{ margin: "10px 0 10px 0" }}>
        <Button onClick={onSinglePlayer}>Start drawing</Button>
        <Button onClick={onStart} disabled={!online}>
          {online ? "Play with others" : "Connecting"}
        </Button>
      </div>
    </>
  );
});

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
        icon={<MenuIcon />}
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
          key={"bugreport"}
          icon={<BugReportIcon />}
          tooltipTitle={"Report a bug"}
          onClick={() =>
            window.open("https://github.com/siidheesh/pictgame/issues")
          }
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

const Main = (props: any) => {
  const { darkMode } = props;
  const [state, send] = useService(mainService); // TODO: use separate actors for each component
  const m = state.matches;
  const inInit = m("init");
  const inIdle = m("idle");
  const inError = m("error");
  const isMatchmaking = m("match");
  const inGame = m("game");
  const inSinglePlayer = m("singlePlayer");
  const deviceIsSmall = useMediaQuery("(max-width:600px)", { noSsr: true });

  debug("main render", state.toStrings().join(" "));

  const logoWrapperProps = { darkMode, deviceIsSmall };

  if (inInit)
    return (
      <LogoWrapper {...logoWrapperProps}>
        <Loading />
      </LogoWrapper>
    );

  if (inError) {
    return <Error msg={state.context.errorMsg} />;
  }

  if (inIdle) {
    const handleStart = () => send("MATCH");
    const handleSinglePlayer = () => send("SINGLEPLAYER");
    return (
      <LogoWrapper {...logoWrapperProps}>
        <Start
          name={state.context.name}
          online={state.context.online}
          onStart={handleStart}
          onSinglePlayer={handleSinglePlayer}
        />
      </LogoWrapper>
    );
  }

  if (isMatchmaking)
    return (
      <Suspense fallback={<Loading />}>
        <UserOffline
          open={!state.context.online}
          onSinglePlayer={() => send("SINGLEPLAYER")}
          onQuit={() => send("QUIT")}
        />
        <Match {...{ state, send }} />
      </Suspense>
    );

  if (inGame)
    return (
      <Suspense fallback={<Loading />}>
        <Game {...{ state, send }} />
      </Suspense>
    );

  if (inSinglePlayer)
    return (
      <Suspense fallback={<Loading />}>
        <Draw
          displayedHistory={state.context.aliceData?.pic ?? []}
          name={"fun!"}
          onQuit={() => send("QUIT")}
          onShare={() => send("PUB_DRAWING")}
          onDrawingChanged={(pic: Stroke[]) =>
            send({ type: "DRAWING_CHANGED", pic })
          }
        />
      </Suspense>
    );

  return <Error msg={`Unhandled state(s): ${state.toStrings().join(" ")}`} />;
};

const ThemeWrapper = (props: any) => {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [darkMode, setDarkMode] = useLocalStorage<boolean | null>(
    "darkMode",
    null
  );
  const currentDarkMode = darkMode ?? prefersDarkMode;

  const theme = createMuiTheme({
    palette: {
      type: currentDarkMode ? "dark" : "light",
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
      <OptionsFAB
        darkMode={currentDarkMode}
        onToggle={() => setDarkMode(!currentDarkMode)}
      />
      {props.children(currentDarkMode)}
    </ThemeProvider>
  );
};

const App = () => (
  <ThemeWrapper>
    {(darkMode: boolean) => <Main {...{ darkMode }} />}
  </ThemeWrapper>
);

export default App;
