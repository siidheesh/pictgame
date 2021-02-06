//import { useService } from "@xstate/react";
//import { mainService, onEvent } from "./machine";
import { Button, TextField } from "@material-ui/core";
import { useState } from "react";
import App from "./App";
import Canvas from "./Canvas";

const Game = (props: any) => {
  //const [state, send] = useService(mainService);
  const { state, send } = props;
  const [guess, setGuess] = useState("");

  const keyPress = (e: React.KeyboardEvent) => {
    if (e?.key === "ENTER" || e?.code === "Enter" || e?.keyCode === 13) {
      send({ type: "ALICE_GUESSED", guess });
    }
  };

  if (state.matches("game.round.alice.drawing")) {
    return (
      <App
        onSubmit={(data: any) => send({ type: "SUBMIT_PIC", data })}
        onEvent={() => {}}
      />
    );
  } else if (state.matches("game.round.bob.drawing")) {
    return <div>waiting for opp to finish drawing</div>;
  } else if (state.matches("game.guessing.alice.waiting")) {
    //<p>Opp pic: {JSON.stringify(state.context.oppData.pic)}</p>
    return (
      <div>
        <Canvas
          strokeHistory={state.context.oppData.pic}
          onStrokeHistoryChange={() => {}}
          forcedHistory={state.context.oppData.pic}
          brushColour={"black"}
          brushRadius={5}
          eraseMode={false}
          locked
        />
        <TextField
          id="filled-basic"
          label="Filled"
          variant="filled"
          onKeyDown={keyPress}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
        />
      </div>
    );
  } else if (state.matches("game.result")) {
    return (
      <div>
        <p>
          you guessed {state.context.aliceGuess}, correct answer was{" "}
          {state.context.oppData.label}
        </p>
        <p>bob guessed {state.context.bobGuess}</p>
        {state.matches("game.guessing.bob.waiting") && (
          <p>bob is still guessing</p>
        )}
        <p>
          <Button onClick={() => send("ALICE_REMATCH")}>
            Ask {state.context.target} for rematch?
          </Button>
          <Button onClick={() => send("ALICE_QUIT")}>Quit</Button>
        </p>
      </div>
    );
  }
  return <div>game fallthru</div>;
};

export default Game;
