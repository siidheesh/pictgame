import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@material-ui/core";
import CheckCircleOutlineRoundedIcon from "@material-ui/icons/CheckCircleOutlineRounded";
import { MainContext } from "./util";
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
        <Typography variant="caption" component="div" color="textSecondary">
          {Math.round(props.value)}
        </Typography>
      </Box>
    </Box>
  );
}

const Match = (props: any) => {
  const { state, send } = props;
  const context: MainContext = state.context;
  const m = state.matches;
  //const [time, setTime] = useState(100);

  console.log("match RENDER");

  /*useEffect(() => {
    if (!m("match.acceptance")) return;
    console.log("useff", time);
    if (time > 0) {
      window.setTimeout(() => setTime(time - 10), 1000);
    }
  });*/

  if (m("idle")) {
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

  if (
    m("match.waiting") ||
    m("match.waitForConfirmation") ||
    m("match.handshake")
  ) {
    /*return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Paper elevation={6}>
          <Box
            p={1}
            style={{
              alignItems: "center",
              justifyContent: "center",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h5">{context.name}</Typography>
            <CircularProgress />
            <p>Searching for matches...</p>
          </Box>
        </Paper>
      </div>
    );*/
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
              height: "200px",
              //borderStyle: "dotted",
              margin: "auto",
              justifyContent: "space-around",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <Typography variant="h5" noWrap>
                Looking for players...
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
              <CircularProgress />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (m("match.acceptance")) {
    const aliceAccepted = m("match.acceptance.alice.ready");
    const bobAccepted = m("match.acceptance.bob.ready");

    const handleAccept = () => send("ALICE_ACCEPTS");
    const handleReject = () => send("ALICE_REJECTS");

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
              justifyContent: "space-around",
              //border: "dashed",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Typography variant="h5" noWrap>
                {context.name}
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
                    Accept
                  </Button>
                  <Button onClick={handleReject} color="secondary">
                    Reject
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
              {!bobAccepted && "is still deciding"}
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
      </div>
    );
  }

  return <div />; //<Match1 {...props} />;
};

export default Match;
