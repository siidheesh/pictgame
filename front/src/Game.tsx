import React, { lazy, Suspense } from "react";
import {
  Button,
  CircularProgress,
  Typography,
  Dialog,
} from "@material-ui/core";
import Error from "./Error";
import { Stroke } from "./Canvas";
import { debug } from "./util";
import Loading from "./Loading";
import Draw from "./Draw";
const Guess = lazy(() => import("./Guess"));
const Result = lazy(() => import("./Result"));
const UserOffline = lazy(() => import("./UserOffline"));

const AwaitBob = React.memo((props: any) => {
  const { name } = props;

  return (
    <div className="center header-padding">
      <div className="center-text mb20">
        <Typography variant="h5">
          Waiting for {name} to finish {props.drawing ? "drawing" : "guessing"}
          ...
        </Typography>
      </div>
      <CircularProgress color="primary" />
    </div>
  );
});

const OppLeftGame = React.memo((props: any) => (
  <Dialog open={props.open} aria-labelledby="" aria-describedby="">
    <div className="center m20">
      <div className="center-text mb20">
        <Typography variant="h6">{props.name} left the game :(</Typography>
      </div>
      <div className="center-row wrap">
        <Button onClick={props.onSinglePlayer}>Continue</Button>
        <Button onClick={props.onMatch}>New Game</Button>
        <Button onClick={props.onQuit}>Quit</Button>
      </div>
    </div>
  </Dialog>
));

const Game = (props: any) => {
  const { state, send } = props;
  const m = state.matches;

  const isDrawing = m("game.round.alice.drawing");
  const waitingForDrawing = m("game.round.bob.drawing");
  const isGuessing = m("game.guessing.alice.waiting");
  const waitingForGuess = m("game.guessing.alice.ready");
  const isEndGame = m("game.result");

  let component = (
    <Error msg={`Unhandled state(s): ${state.toStrings().join(" ")}`} />
  );

  debug("Game render");

  if (isDrawing) {
    component = (
      <Draw
        displayedHistory={state.context.aliceData?.pic ?? []}
        name={state.context.target}
        onSubmit={(data: any) => send({ type: "SUBMIT_PIC", data })}
        onQuit={() => send("QUIT")}
        onDrawingChanged={(pic: Stroke[]) =>
          send({ type: "DRAWING_CHANGED", pic })
        }
        onShare={() => send("PUB_DRAWING")}
      />
    );
  } else if (waitingForDrawing || waitingForGuess) {
    component = (
      <AwaitBob name={state.context.target} drawing={waitingForDrawing} />
    );
  } else if (isGuessing) {
    const handleGuess = (guess: string) =>
      send({ type: "ALICE_GUESSED", guess });

    component = (
      <Suspense fallback={<Loading />}>
        <Guess
          onGuess={handleGuess}
          oppData={{ ...state.context.oppData, name: state.context.target }}
        />
      </Suspense>
    );
  }

  if (isEndGame) {
    const resultProps = {
      aliceGuess: state.context.aliceGuess,
      bobGuess: state.context.bobGuess,
      aliceData: state.context.aliceData,
      oppData: state.context.oppData,
      bobName: state.context.target || "your opponent", //FIXME: resolve situ where target is cleared while Results is shown
      rematchAvailable:
        state.context.online &&
        !state.context.oppDisconnected &&
        !m("game.result.noRematch"),
      rematchModal:
        m("game.result.waitForBob") || m("game.result.waitForDecision"),
      rematchModalType: m("game.result.waitForBob"),
      onRematch: () => send("REMATCH"),
      onRematchAck: () => send("REMATCH_OK"),
      onRematchReject: () => send("REMATCH_REJECT"),
      onNewGame: () => send("GOTO_MATCH"),
      onQuit: () => send("QUIT"),
    };
    return (
      <Suspense fallback={<Loading />}>
        <Result {...resultProps} />
      </Suspense>
    );
  } else
    return (
      <>
        <OppLeftGame
          open={state.context.target && state.context.oppDisconnected}
          name={state.context.target}
          onMatch={() => send("GOTO_MATCH")}
          onSinglePlayer={() => send("SINGLEPLAYER")}
          onQuit={() => send("QUIT")}
        />
        <UserOffline
          open={!state.context.online || !state.context.target}
          onSinglePlayer={() => send("SINGLEPLAYER")}
          onQuit={() => send("QUIT")}
        />
        {component}
      </>
    );
};

export default Game;
