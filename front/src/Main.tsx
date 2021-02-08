import React, { useState } from "react";
import { useService } from "@xstate/react";
import { mainService } from "./machine";
import Game from "./Game";
import Match from "./Match";
import { CircularProgress, CssBaseline, Typography } from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import Brightness7RoundedIcon from "@material-ui/icons/Brightness7Rounded";
import Brightness4RoundedIcon from "@material-ui/icons/Brightness4Rounded";
import { ThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import { useLocalStorage } from "./util";
const Loading = (props: any) => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <CircularProgress />
    {props.msg}
  </div>
);

const Error = (props: any) => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Typography variant="h4">Error ☠️</Typography>
    <br />
    <Typography variant="caption">{props.msg}</Typography>
  </div>
);

const Main = () => {
  const [state, send] = useService(mainService);
  const m = state.matches;

  console.log("main RENDER");

  if (m("init")) {
    let msg = "Loading...";
    if (m("init.prepareSocket.disconnected")) {
      msg = "Establishing connection";
    } else if (m("init.prepareSocket.waitForName")) {
      msg = "Starting session";
    }
    return <Loading msg={msg} />;
  }

  if (m("error")) {
    return <Error msg={state.context.errorMsg} />;
  }

  return m("game") ? (
    <Game {...{ state, send }} />
  ) : (
    <Match {...{ state, send }} />
  );
};

const App = (props: any) => {
  const [darkMode, setDarkMode] = useLocalStorage<boolean>("darkMode", true);
  const theme = createMuiTheme({
    palette: {
      type: darkMode ? "dark" : "light",
    },
    overrides: {
      MuiPaper: {
        root: {
          backgroundColor: "white",
        },
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          paddingRight: "10px",
          paddingTop: "10px",
          zIndex: 999,
        }}
      >
        <ToggleButton
          value={darkMode}
          selected={darkMode}
          onChange={() => setDarkMode(!darkMode)}
        >
          {darkMode ? <Brightness7RoundedIcon /> : <Brightness4RoundedIcon />}
        </ToggleButton>
      </div>
      <Main />
    </ThemeProvider>
  );
};

export default App;
