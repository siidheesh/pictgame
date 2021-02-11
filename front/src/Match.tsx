import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@material-ui/core";
import CheckCircleOutlineRoundedIcon from "@material-ui/icons/CheckCircleOutlineRounded";
import { MainContext, debug } from "./util";

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
          {Math.round(props.label)}
        </Typography>
      </Box>
    </Box>
  );
}

const LookingForPlayers = (props: any) => {
  const showNoPlayerMsgDelay = 3000;
  const [showNoPlayersMsg, setShowNoPlayersMsg] = useState(false);

  useEffect(() => {
    debug("useff matchmaking");
    const h = window.setTimeout(() => {
      debug("useff matchmaking cb");
      setShowNoPlayersMsg(true);
    }, showNoPlayerMsgDelay);
    return () => {
      debug("useff matchmaking cleanup");
      window.clearTimeout(h);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        margin: "auto",
        //border: "red dashed",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <Typography variant="h5" noWrap>
          Looking for players...
        </Typography>
        <Typography
          variant="subtitle1"
          style={{ visibility: showNoPlayersMsg ? "visible" : "hidden" }}
        >
          None found yet, we'll keep searching!
        </Typography>
      </div>
      <div>
        <CircularProgress color="primary" />
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

  const maxTime = 9;
  const [timeLeft, setTimeLeft] = useState(maxTime);

  useEffect(() => {
    // TODO: move into mainMachine?
    debug("useff acceptance", timeLeft);
    if (timeLeft >= 0) {
      const h = window.setTimeout(
        () => setTimeLeft(timeLeft - 1),
        timeLeft > 0 ? 1000 : 500
      );
      return () => {
        debug("useff acceptance cleanup", timeLeft);
        window.clearTimeout(h);
      };
    } else handleTimeout();
  }, [timeLeft, handleTimeout]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        margin: "auto",
        //border: "red dashed",
        padding: "50px 0 50px 0",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <Typography variant="h4" align="center">
          Player found!
        </Typography>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          //border: "yellow dashed",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: "300px",
            //border: "blue dashed",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "20px",
            }}
          >
            <Typography variant="h5" noWrap>
              {context.name}
            </Typography>
            <Typography variant="subtitle2" noWrap>
              (aka you)
            </Typography>
          </div>

          {aliceAccepted ? (
            <CheckCircleOutlineRoundedIcon
              style={{
                width: 50,
                height: 50,
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                marginTop: "10px",
              }}
            >
              <Button onClick={handleAccept} color="primary">
                ✅
              </Button>
              <Button onClick={handleReject} color="secondary">
                ❌
              </Button>
            </div>
          )}
        </div>

        <div
          style={{
            width: "300px",
            //border: "orange dashed",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
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
                width: 50,
                height: 50,
              }}
            />
          ) : (
            <CircularProgress />
          )}
        </div>
      </div>
      <div style={{ margin: "auto" }}>
        <CircularProgressWithLabel
          value={timeLeft > 0 ? (timeLeft / maxTime) * 100 : 100}
          label={timeLeft}
          color={timeLeft <= 4 ? "secondary" : "primary"}
        />
      </div>
    </div>
  );
};

const Match = (props: any) => {
  const { state, send } = props;
  const context: MainContext = state.context;
  const m = state.matches;

  const inMatchmaking =
    m("match.waiting") ||
    m("match.waitForConfirmation") ||
    m("match.handshake");
  const inAcceptance = m("match.acceptance");

  debug("Match render");

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

  return <div>match: unhandled {state.toStrings().join(" ")}</div>;
};

export default Match;
