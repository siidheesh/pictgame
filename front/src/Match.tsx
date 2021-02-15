import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@material-ui/core";
import CheckCircleOutlineRoundedIcon from "@material-ui/icons/CheckCircleOutlineRounded";
import { debug } from "./util";
import Error from "./Error";

function CircularProgressWithLabel(props: any) {
  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress variant="determinate" {...props} />
      <Box className="circprogress-box">
        <Typography variant="h5" component="div" color="textSecondary">
          {Math.round(props.label)}
        </Typography>
      </Box>
    </Box>
  );
}

const LookingForPlayers = React.memo((props: any) => {
  const { showMsg, timedOut, onMatch, onSinglePlayer, onQuit } = props;

  if (timedOut) {
    return (
      <div className="center center-text header-padding">
        <div className="mb30">
          <Typography variant="h5" noWrap>
            No players found 🙁
          </Typography>
        </div>
        <div className="center-row">
          <Button onClick={onMatch}>Try again</Button>
          <Button onClick={onSinglePlayer}>Start drawing</Button>
          <Button onClick={onQuit}>Quit</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="center center-text">
      <div className="mb30">
        <Typography variant="h5" noWrap>
          Looking for players...
        </Typography>
        <Typography
          variant="subtitle1"
          style={{ visibility: showMsg ? "visible" : "hidden" }}
        >
          None found yet, we'll keep searching!
        </Typography>
      </div>
      <div>
        <CircularProgress color="primary" />
      </div>
    </div>
  );
});

const Acceptance = (props: any) => {
  const {
    name,
    target,
    aliceAccepted,
    bobAccepted,
    onAccept,
    onReject,
    onTimeout,
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
    } else onTimeout();
  }, [timeLeft, onTimeout]);

  return (
    <div className="center header-padding">
      <div className="center-text mb20">
        <Typography variant="h4">Player found!</Typography>
      </div>
      <div className="center-row wrap mb20">
        <div className="center acceptance-box">
          <div className="center-text mb20">
            <Typography variant="h5" noWrap>
              {name}
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
            <div className="center-row mt10">
              <Button onClick={onAccept} color="primary">
                ✅
              </Button>
              <Button onClick={onReject} color="secondary">
                ❌
              </Button>
            </div>
          )}
        </div>

        <div className="center acceptance-box">
          <div className="center-text mb20">
            <Typography variant="h5" noWrap>
              {target}
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
      <CircularProgressWithLabel
        value={timeLeft > 0 ? (timeLeft / maxTime) * 100 : 100}
        label={timeLeft}
        color={timeLeft <= 4 ? "secondary" : "primary"}
      />
    </div>
  );
};

const Match = (props: any) => {
  const { state, send } = props;
  const m = state.matches;

  const timedOut = m("match.timedOut");
  const inMatchmaking =
    m("match.waiting") ||
    m("match.waitForConfirmation") ||
    m("match.handshake") ||
    timedOut;

  debug("Match render");

  if (inMatchmaking) {
    return (
      <LookingForPlayers
        timedOut={timedOut}
        showMsg={state.context.helloCounter > 1}
        onMatch={() => send("MATCH")}
        onSinglePlayer={() => send("SINGLEPLAYER")}
        onQuit={() => send("QUIT")}
      />
    );
  }

  if (m("match.acceptance"))
    return (
      <Acceptance
        name={state.context.name}
        target={state.context.target}
        aliceAccepted={m("match.acceptance.alice.ready")}
        bobAccepted={m("match.acceptance.bob.ready")}
        onAccept={() => send("ALICE_ACCEPTS")}
        onReject={() => send("ALICE_REJECTS")}
        onTimeout={() => send("TIMEOUT")}
      />
    );

  return <Error msg={`Unhandled state(s): ${state.toStrings().join(" ")}`} />;
};

export default Match;
