import { Button } from "@material-ui/core";
import { useService } from "@xstate/react";
//import React, { useState, useRef, useEffect } from "react";
import { mainService } from "./machine";
import { Game } from "./Game";

const Match = (props: any) => {
  const [state, send] = useService(mainService);
  //const { state, send } = props;
  return (
    <main style={{ margin: "10px" }}>
      <p id="currstate">{state.toStrings().join(" ")}</p>
      <div>
        {state.matches("init") && <h1>LOADING...</h1>}
        <p style={{ overflow: "auto", wordWrap: "break-word" }}>
          {JSON.stringify(state.context)}
        </p>
        <p>
          my lvl is: {state.context.allowLower && "<="}
          {state.context.level}
        </p>
        <p>my id is: {state.context.name}</p>
        <p>my opp is: {state.context.target}</p>
        {state.matches("match.acceptance.bob.wait") && (
          <p>waiting for bob's reply</p>
        )}
        {state.matches("idle") && (
          <Button onClick={() => send("MATCH")}>Find match</Button>
        )}
        {state.matches("match.acceptance.alice.wait") && (
          <div>
            <Button onClick={() => send("ALICE_ACCEPTS")}>Accept</Button>
            <Button onClick={() => send("ALICE_REJECTS")}>Reject</Button>
          </div>
        )}

        {!state.matches("idle") && (
          <Button onClick={() => send("QUIT")}>QUIT</Button>
        )}
      </div>
    </main>
  );
};

const Main = () => {
  const [state] = useService(mainService);

  const inGame = state.matches("game");

  if (inGame) {
    return <Game /*{...{ state, send }}*/ />;
  }

  return <Match /*{...{ state, send }}*/ />;
};

export default Main;
