import React, { useState } from "react";
import { useService } from "@xstate/react";
import { mainService } from "./machine";
import Game from "./Game";
import Match from "./Match";
import { CircularProgress } from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import Brightness7RoundedIcon from "@material-ui/icons/Brightness7Rounded";
import Brightness4RoundedIcon from "@material-ui/icons/Brightness4Rounded";

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

const Main = () => {
  const [state, send] = useService(mainService);
  const [darkMode, setDarkMode] = useState(false);
  const m = state.matches;

  //const [open, setOpen] = useState(true);
  /*
  useEffect(() => {
    console.log("closure", state);
    const handle = window.setTimeout(() => setOpen(false), 2000);
    return () => {
      console.log("cleartimer", state);
      window.clearTimeout(handle);
    };
  });*/

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

  return (
    <React.Fragment>
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          paddingRight: "10px",
          paddingTop: "10px",
        }}
      >
        {/*<Switch
          checkedIcon={<Brightness4RoundedIcon />}
          icon={<Brightness7RoundedIcon color="primary" />}
          size="medium"
        />*/}
        <ToggleButton
          selected={darkMode}
          onChange={() => setDarkMode(!darkMode)}
        >
          {darkMode ? <Brightness4RoundedIcon /> : <Brightness7RoundedIcon />}
        </ToggleButton>
      </div>
      {m("game") ? (
        <Game {...{ state, send, darkMode }} />
      ) : (
        <Match {...{ state, send, darkMode }} />
      )}
    </React.Fragment>
  );
};

export default Main;
