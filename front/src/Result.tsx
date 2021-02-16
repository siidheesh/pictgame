import React from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import Canvas from "./Canvas";

const ResultRematchWait = React.memo((props: any) => (
  <div className="center m20">
    <div className="center-text mb20">
      <Typography variant="h6">Waiting for {props.name}</Typography>
    </div>
    <CircularProgress color="primary" />
  </div>
));

const ResultRematchDecide = React.memo((props: any) => (
  <div className="center m20">
    <div className="center-text mb20">
      <Typography variant="h6">{props.name} wants a rematch ❗</Typography>
    </div>
    <div className="center-row wrap">
      <Button onClick={props.onAccept}>✅</Button>
      <Button onClick={props.onReject}>❌</Button>
    </div>
  </div>
));

const Result = (props: any) => {
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
  const deviceIsSmall = useMediaQuery("(max-width:1100px)", { noSsr: true });

  return (
    <>
      <Dialog
        open={rematchModal && rematchAvailable}
        aria-labelledby=""
        aria-describedby=""
      >
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

      <div className="center header-padding">
        <div className="center-text mb50">
          <Typography variant="h4">
            Who won? Who lost? You decide! 🥳
          </Typography>
        </div>
        <div className="center-row wrap center-text">
          <div className="center p10">
            <div className="mb20">
              <Typography variant="h5">Your guess:</Typography>
              <Typography variant="h6">{aliceGuess}</Typography>
            </div>
            <Canvas
              displayedHistory={oppData.pic}
              size={deviceIsSmall ? 300 : 500}
              locked
            />
            <div className="m20">
              <Typography variant="subtitle1">
                According to {bobName}, it's:
              </Typography>
              <Typography variant="subtitle1">{oppData.label}</Typography>
            </div>
          </div>

          <div className="center p10">
            <div className="mb20">
              <Typography variant="h5">{bobName}'s guess:</Typography>
              <Typography variant="h6">{bobGuess}</Typography>
            </div>
            <Canvas
              displayedHistory={aliceData.pic}
              size={deviceIsSmall ? 300 : 500}
              locked
            />
            <div className="m20">
              <Typography variant="subtitle1">
                According to you, it's:
              </Typography>
              <Typography variant="subtitle1">{aliceData.label}</Typography>
            </div>
          </div>
        </div>
        <div className="center-row wrap">
          <Button onClick={onRematch} disabled={!rematchAvailable}>
            {rematchAvailable ? "Ask for Rematch" : "Opponent has left"}
          </Button>
          <Button onClick={onNewGame}>New Game</Button>
          <Button onClick={onQuit}>Quit</Button>
        </div>
      </div>
    </>
  );
};

export default Result;
