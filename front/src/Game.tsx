import { useService } from "@xstate/react";
import React, { useState, useRef, useEffect } from "react";
import { AnyEventObject, PayloadSender, State } from "xstate";
import App from "./App";
import Canvas, { Stroke } from "./Canvas";
import { mainService, onEvent } from "./machine";
import { MainContext } from "./util";

interface GameContext {
  round: number;
  opponent: string;
}

interface GameProps {
  state: State<
    MainContext,
    AnyEventObject,
    any,
    { value: any; context: MainContext }
  >;
  send: PayloadSender<AnyEventObject>;
}

export const Game = () => {
  const [state, send] = useService(mainService);

  if (state.matches("game.round.alice.drawing")) {
    return (
      <App
        onSubmit={(data: any) => send({ type: "SUBMIT_PIC", data })}
        onEvent={onEvent(state.context.target)}
      />
    );
  } else if (state.matches("game.round.bob.drawing")) {
    return <div>waiting for opp...</div>;
  } else if (state.matches("game.guessing")) {
    return (
      <div>
        <Canvas
          strokeHistory={state.context.oppPic}
          onStrokeHistoryChange={(_) => {}}
          forcedHistory={state.context.oppPic}
          brushColour={"black"}
          brushRadius={5}
          eraseMode={false}
        />
        <p>Opp pic: {JSON.stringify(state.context.oppPic)}</p>
      </div>
    );
  } else if (state.matches("game.result")) {
    return <div>game result</div>;
  }
  return <div>game fallthru</div>;
};
