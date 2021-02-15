import React from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  Typography,
} from "@material-ui/core";
import Canvas from "./Canvas";

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
    deviceIsSmall,
  } = props;

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

      <div
        style={{
          margin: "auto",
          display: "flex",
          flexDirection: "column",
          //border: "dashed",
          padding: "70px 5px 50px 5px",
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
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ marginBottom: "20px" }}>
              <Typography variant="h5">Your guess:</Typography>
              <Typography variant="h6">{aliceGuess}</Typography>
            </div>
            <Canvas
              displayedHistory={oppData.pic}
              size={deviceIsSmall ? 300 : 500}
              locked
            />
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
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ marginBottom: "20px" }}>
              <Typography variant="h5">{bobName}'s guess:</Typography>
              <Typography variant="h6">{bobGuess}</Typography>
            </div>
            <Canvas
              displayedHistory={aliceData.pic}
              size={deviceIsSmall ? 300 : 500}
              locked
            />
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
    </>
  );
});

export default Result;
