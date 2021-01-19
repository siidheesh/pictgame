import { Button } from "@material-ui/core";
import { useService } from "@xstate/react";
//import React, { useState, useRef, useEffect } from "react";
import { mainService } from "./machine";
//import { interpret } from "xstate";
//import { io } from "socket.io-client";

const Main = (props: any) => {
  const [state, send] = useService(mainService); // rerender on matchState change

  return (
    <main style={{ margin: "10px" }}>
      <header>State(s): {state.toStrings().join(" ")}</header>
      <div>
        {state.matches("init") && <h1>LOADING...</h1>}
        <p>{JSON.stringify(state.context)}</p>
        <Button onClick={() => send("MATCH")}>Find match</Button>
        <Button onClick={() => send("ALICE_ACCEPTS")}>Accept</Button>
        <Button onClick={() => send("REJECT")}>Reject</Button>
        <Button onClick={() => send("QUIT")}>QUIT</Button>
      </div>
    </main>
  );
};

export default Main;
