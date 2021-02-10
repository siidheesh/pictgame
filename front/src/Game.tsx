import React, { useState } from "react";
import {
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
  Dialog,
} from "@material-ui/core";

import Draw from "./Draw";
import Canvas from "./Canvas";

const Guess = (props: any) => {
  const { oppData, onGuess } = props;
  const [guess, setGuess] = useState("");
  const [inputValid, setInputValid] = useState({ guess: false });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e?.key === "Enter" || e?.code === "Enter" || e?.keyCode === 13) {
      inputValid.guess && onGuess(guess);
    }
  };

  const handleGuessChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newGuess = e.target.value;
    setGuess(newGuess);
    setInputValid({ guess: !!newGuess });
  };

  return (
    <div
      style={{
        display: "grid",
        height: "100%",
        //border: "green dashed",
        padding: "70px 10px 50px 10px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          //border: "dashed",
          alignItems: "center",
          margin: "auto",
        }}
      >
        <div style={{ marginBottom: "50px" }}>
          <Typography variant="h5" noWrap>
            {oppData.name} drew this!
          </Typography>
        </div>
        <div>
          <Paper elevation={6} style={{ width: "400px", height: "400px" }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Canvas displayedHistory={oppData.pic} locked />
            </div>
          </Paper>
        </div>
        <div style={{ margin: "20px" }}>
          <Typography variant="h5" noWrap>
            What could it be? 🤔
          </Typography>
        </div>
        <TextField
          label="Your guess"
          variant="outlined"
          onKeyDown={handleKeyDown}
          value={guess}
          onChange={handleGuessChange}
          helperText={
            inputValid.guess
              ? "(press enter to lock in your guess)"
              : "Must be filled!"
          }
          error={!inputValid.guess}
        />
        <Typography
          variant="caption"
          noWrap
          style={{ visibility: guess ? "visible" : "hidden" }}
        >
          {false && "(press enter to lock in your guess)"}
        </Typography>
      </div>
    </div>
  );
};

const AwaitBob = React.memo((props: any) => {
  const { name } = props;

  return (
    <div
      style={{
        display: "grid",
        height: "100%",
        padding: "10px",
        //border: "green dashed",
      }}
    >
      <div
        style={{
          margin: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          //border: "red dashed",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <Typography variant="h5">
            Waiting for {name} to finish{" "}
            {props.drawing ? "drawing" : "guessing"}...
          </Typography>
        </div>
        <CircularProgress color="primary" />
      </div>
    </div>
  );
});

const ResultRematchWait = React.memo((props: any) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      margin: "20px",
    }}
  >
    <div style={{ textAlign: "center", marginBottom: "20px" }}>
      <Typography variant="h6">Waiting for {props.name}</Typography>
    </div>
    <CircularProgress color="primary" />
  </div>
));

const ResultRematchDecide = React.memo((props: any) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      margin: "20px",
    }}
  >
    <div style={{ textAlign: "center", marginBottom: "20px" }}>
      <Typography variant="h6">{props.name} wants a rematch ❗</Typography>
    </div>
    <div>
      <Button onClick={props.onAccept}>✅</Button>
      <Button onClick={props.onReject}>❌</Button>
    </div>
  </div>
));

const Result = React.memo((props: any) => {
  const {
    aliceGuess,
    bobGuess,
    aliceData,
    oppData,
    bobName,
    onRematch,
    onRematchAck,
    onNewGame,
    onQuit,
    onRematchReject,
    rematchModal,
    rematchModalType,
    rematchAvailable,
  } = props;

  return (
    <React.Fragment>
      <Dialog open={rematchModal} aria-labelledby="" aria-describedby="">
        {rematchModal &&
          (rematchModalType ? (
            <ResultRematchWait name={bobName} />
          ) : (
            <ResultRematchDecide
              name={bobName}
              onAccept={onRematchAck}
              onReject={onRematchReject}
            />
          ))}
      </Dialog>
      <div
        style={{
          display: "grid",
          height: "100%",
          //border: "green dashed",
          padding: "70px 5px 50px 5px",
        }}
      >
        <div
          style={{
            margin: "auto",
            display: "flex",
            flexDirection: "column",
            //border: "dashed",
          }}
        >
          <div style={{ marginBottom: "50px" }}>
            <Typography variant="h4" align="center">
              Who won? Who lost? You decide! 🥳
            </Typography>
          </div>
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              boxSizing: "inherit",
              justifyContent: "center",
              alignItems: "center",
              //border: "red dashed",
            }}
          >
            <div
              style={{
                //border: "blue dashed",
                padding: "10px",
              }}
            >
              <div style={{ marginBottom: "20px" }}>
                <Typography variant="h5">Your guess:</Typography>
                <Typography variant="h6">{aliceGuess}</Typography>
              </div>
              <div>
                <Paper
                  elevation={6}
                  style={{ width: "400px", height: "400px" }}
                >
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <Canvas displayedHistory={oppData.pic} locked />
                  </div>
                </Paper>
              </div>
              <div style={{ margin: "20px" }}>
                <Typography variant="subtitle1">
                  According to {bobName}, it's:
                </Typography>
                <Typography variant="subtitle1">{oppData.label}</Typography>
              </div>
            </div>

            <div
              style={{
                //border: "orange dashed",
                padding: "10px",
              }}
            >
              <div style={{ marginBottom: "20px" }}>
                <Typography variant="h5">{bobName}'s guess:</Typography>
                <Typography variant="h6">{bobGuess}</Typography>
              </div>
              <div>
                <Paper
                  elevation={6}
                  style={{ width: "400px", height: "400px" }}
                >
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <Canvas displayedHistory={aliceData.pic} locked />
                  </div>
                </Paper>
              </div>
              <div style={{ margin: "20px" }}>
                <Typography variant="subtitle1">
                  According to you, it's:
                </Typography>
                <Typography variant="subtitle1">{aliceData.label}</Typography>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button onClick={onRematch} disabled={!rematchAvailable}>
              {rematchAvailable ? "Ask for Rematch" : "Opponent has left"}
            </Button>
            <Button onClick={onNewGame}>New Game</Button>
            <Button onClick={onQuit}>Quit</Button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
});

const OppLeftGame = React.memo((props: any) => (
  <Dialog open={props.open} aria-labelledby="" aria-describedby="">
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        margin: "20px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <Typography variant="h6">{props.name} left the game :(</Typography>
      </div>
      <div>
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

  let component = <div>game: unhandled {state.toStrings().join(" ")}</div>;

  if (isDrawing) {
    component = (
      <Draw
        name={state.context.target}
        onSubmit={(data: any) => send({ type: "SUBMIT_PIC", data })}
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
      <Guess
        onGuess={handleGuess}
        oppData={{ ...state.context.oppData, name: state.context.target }}
      />
    );
  }

  if (isEndGame) {
    const resultProps = {
      aliceGuess: state.context.aliceGuess,
      bobGuess: state.context.bobGuess,
      aliceData: state.context.aliceData,
      oppData: state.context.oppData,
      bobName: state.context.target,
      rematchAvailable:
        !state.context.oppDisconnected && !m("game.result.noRematch"),
      rematchModal:
        m("game.result.waitForBob") || m("game.result.waitForDecision"),
      rematchModalType: m("game.result.waitForBob"),
      onRematch: () => send("REMATCH"),
      onRematchAck: () => send("REMATCH_OK"),
      onRematchReject: () => send("REMATCH_REJECT"),
      onNewGame: () => send("GOTO_MATCH"),
      onQuit: () => send("QUIT"),
    };
    return <Result {...resultProps} />;
  } else
    return (
      <React.Fragment>
        <OppLeftGame
          open={state.context.oppDisconnected}
          name={state.context.target}
          onMatch={() => send("GOTO_MATCH")}
          onQuit={() => send("QUIT")}
        />
        {component}
      </React.Fragment>
    );
};

export default Game;
