import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@material-ui/core";
import CheckCircleOutlineRoundedIcon from "@material-ui/icons/CheckCircleOutlineRounded";
import { MainContext } from "./util";
import { time } from "console";
//import { useService } from "@xstate/react";
//import { mainService } from "./machine";

const Match1 = (props: any) => {
  //const [state, send] = useService(mainService);
  const { state, send } = props;

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

function CircularProgressWithLabel(props: any) {
  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress variant="determinate" {...props} />
      <Box
        top={0}
        left={0}
        bottom={0}
        right={0}
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography variant="h5" component="div" color="textSecondary">
          {Math.round(props.value / 10)}
        </Typography>
      </Box>
    </Box>
  );
}

const LookingForPlayers = (props: any) => {
  const showNoPlayerMsgDelay = 3000;
  const [showNoPlayersMsg, setShowNoPlayersMsg] = useState(false);

  useEffect(() => {
    console.log("useff matchmaking");
    const h = window.setTimeout(() => {
      console.log("useff matchmaking cb");
      setShowNoPlayersMsg(true);
    }, showNoPlayerMsgDelay);
    return () => {
      console.log("useff matchmaking cleanup");
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          //border: "solid blue",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            height: "250px",
            //border: "dotted",
            margin: "auto",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Typography variant="h5" noWrap>
              Looking for players...
            </Typography>
            {showNoPlayersMsg && (
              <Typography variant="subtitle1">
                No one found yet, we'll keep searching!
              </Typography>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <CircularProgress color="primary" />
          </div>
        </div>
      </div>
    </div>
  );
};

const Acceptance = (props: any) => {
  const {
    context,
    aliceAccepted,
    bobAccepted,
    handleAccept,
    handleReject,
    handleTimeout,
  } = props;

  const maxTime = 10;
  const [timeLeft, setTimeLeft] = useState(maxTime);

  useEffect(() => {
    // TODO: move into mainMachine?
    console.log("useff acceptance", timeLeft);
    if (timeLeft > 0) {
      const h = window.setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => {
        console.log("useff acceptance cleanup", timeLeft);
        window.clearTimeout(h);
      };
    } else handleTimeout();
  }, [timeLeft, handleTimeout]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        //border: "dashed",
      }}
    >
      <div style={{ paddingBottom: "20px" }}>
        <Typography variant="h4" align="center">
          Player found!
        </Typography>
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          //border: "dashed",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "300px",
            height: "200px",
            //borderStyle: "dotted",
            margin: "auto",
            justifyContent: "center",
            //border: "dashed",
          }}
        >
          <div
            style={{
              textAlign: "center" /*display: "flex", justifyContent: "center"*/,
            }}
          >
            <Typography variant="h5" noWrap>
              {context.name}
            </Typography>
            <Typography variant="subtitle2" noWrap>
              {
                /*aliceAccepted
                ? "(aka you) is ready to play!"
              : "(aka you) is still deciding"*/ "(aka you)"
              }
            </Typography>
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {aliceAccepted ? (
              <CheckCircleOutlineRoundedIcon
                style={{
                  width: 80,
                  height: 80,
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  //border: "dashed red",
                  justifyContent: "center",
                }}
              >
                <Button onClick={handleAccept} color="primary">
                  Ready
                </Button>
                <Button onClick={handleReject} color="secondary">
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
        <br />
        <div
          style={{
            position: "relative",
            width: "300px",
            height: "200px",
            //border: "dashed",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Typography variant="h5" noWrap>
              {context.target}
            </Typography>
            <Typography variant="subtitle2" noWrap>
              {bobAccepted ? "is ready to play!" : "is still deciding"}
            </Typography>
          </div>
          {bobAccepted ? (
            <CheckCircleOutlineRoundedIcon
              style={{
                width: 80,
                height: 80,
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <CircularProgress />
            </div>
          )}
        </div>
      </div>
      <div style={{ margin: "auto" }}>
        <CircularProgressWithLabel
          value={(timeLeft / maxTime) * 100}
          color={timeLeft <= 5 ? "secondary" : "primary"}
        />
      </div>
    </div>
  );
};

const Match = (props: any) => {
  const { state, send } = props;
  const context: MainContext = state.context;
  const m = state.matches;

  const inIdle = m("idle");
  const inMatchmaking =
    m("match.waiting") ||
    m("match.waitForConfirmation") ||
    m("match.handshake");
  const inAcceptance = m("match.acceptance");

  console.log("match RENDER");

  /*useEffect(() => {
    if (inMatchmaking) {
      console.log("useff matchmaking");
      const h = window.setTimeout(() => {
        console.log("useff matchmaking cb");
        setShowNoPlayersMsg(true);
      }, 3000);
      return () => {
        console.log("useff matchmaking cleanup");
        window.clearTimeout(h);
      };
    } else {
      setShowNoPlayersMsg(false);
    }
  }, [inMatchmaking]);*/

  if (inIdle) {
    const handleStart = () => send("MATCH");

    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Box
          style={{
            alignItems: "center",
            justifyContent: "center",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography variant="h5">Welcome, {context.name}!</Typography>
          <Button onClick={handleStart}>Start a round</Button>
        </Box>
      </div>
    );
  }

  if (inMatchmaking) {
    return <LookingForPlayers />;
  }

  if (inAcceptance) {
    const aliceAccepted = m("match.acceptance.alice.ready");
    const bobAccepted = m("match.acceptance.bob.ready");

    const handleAccept = () => send("ALICE_ACCEPTS");
    const handleReject = () => send("ALICE_REJECTS");
    const handleTimeout = () => send("TIMEOUT");

    return (
      <Acceptance
        {...{
          context,
          aliceAccepted,
          bobAccepted,
          handleAccept,
          handleReject,
          handleTimeout,
        }}
      />
    );
  }

  return <div />; //<Match1 {...props} />;
};

export default Match;
